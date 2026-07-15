# AI-SDLC — From-scratch local setup

This is the end-to-end recipe for standing up the whole pipeline on a single machine:
a real local **Jenkins** that runs the generated automation, a **GitHub** repo with an
approval-gated `main`, and a **simulated Jira** so requirements arrive as tickets — with
no external Jira dependency. It mirrors the setup that produced the running instance on
this machine.

> **Layout used here:** the Jenkins runtime lives outside the repo at
> `~/ai-sdlc-stack/` (WAR, `JENKINS_HOME`, admin token). The repo itself is the app +
> plugin (tooling only). The target the pipeline builds and tests is a **separate repo**,
> [aiqalearning/ai-sdlc-demo-app](https://github.com/aiqalearning/ai-sdlc-demo-app), cloned locally and registered in `repos.yaml`.

---

## 0. Prerequisites

| Tool | Version used | Install |
|------|--------------|---------|
| Node.js | 20+ (26 here) | nodejs.org / nvm |
| Java (for Jenkins) | **21 LTS** — *not* 25/26 | `brew install openjdk@21` |
| `gh` CLI | 2.96 | `brew install gh` |
| Git | any recent | preinstalled |

Jenkins supports Java 21 and 25 only; newer JDKs refuse to boot without a preview flag.
Install 21 and point Jenkins at it explicitly (below), regardless of your system default.

---

## 1. Local Jenkins (native WAR, no Docker)

```bash
STACK="$HOME/ai-sdlc-stack"; JH="$STACK/jenkins"
mkdir -p "$JH/init.groovy.d"

# 1a. Download Jenkins (stable LTS) + the plugin manager
curl -fsSL -o "$STACK/jenkins.war" https://get.jenkins.io/war-stable/latest/jenkins.war
PMV=$(curl -fsSL https://api.github.com/repos/jenkinsci/plugin-installation-manager-tool/releases/latest \
      | grep -m1 '"tag_name"' | sed -E 's/.*"([0-9.]+)".*/\1/')
curl -fsSL -o "$STACK/plugin-manager.jar" \
  "https://github.com/jenkinsci/plugin-installation-manager-tool/releases/download/${PMV}/jenkins-plugin-manager-${PMV}.jar"

# 1b. Install the plugins the Jenkinsfile needs (deps auto-resolved → ~70 plugins)
java -jar "$STACK/plugin-manager.jar" --war "$STACK/jenkins.war" \
  --plugin-download-directory "$JH/plugins" \
  --plugins workflow-aggregator git junit timestamper ws-cleanup
```

**1c. Headless security + API token** — create `$JH/init.groovy.d/01-bootstrap.groovy`:

```groovy
import jenkins.model.*
import hudson.security.*
import jenkins.security.ApiTokenProperty

def instance = Jenkins.get()
def realm = new HudsonPrivateSecurityRealm(false)
if (hudson.model.User.getById('admin', false) == null) realm.createAccount('admin', 'admin123')
instance.setSecurityRealm(realm)
def strategy = new FullControlOnceLoggedInAuthorizationStrategy()
strategy.setAllowAnonymousRead(false)
instance.setAuthorizationStrategy(strategy)
instance.setNumExecutors(2)
instance.save()

def user = hudson.model.User.getById('admin', true)
def prop = user.getProperty(ApiTokenProperty.class)
def tokenFile = new File("${System.getenv('HOME')}/ai-sdlc-stack/admin-api-token.txt")
if (!tokenFile.exists()) { def r = prop.tokenStore.generateNewToken('ai-sdlc'); user.save(); tokenFile.text = r.plainValue }
```

**1d. Start it** (Java 21, setup wizard disabled). Keep this process running:

```bash
JH21="$(brew --prefix)/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
JENKINS_HOME="$JH" "$JH21/bin/java" -Djenkins.install.runSetupWizard=false \
  -jar "$STACK/jenkins.war" --httpPort=8080
```

Verify: `curl -u admin:$(cat "$STACK/admin-api-token.txt") http://localhost:8080/api/json` → HTTP 200.
UI: http://localhost:8080 — user `admin`, password `admin123`.

---

## 2. GitHub repo + approval-gated `main`

```bash
gh auth login                                   # HTTPS + browser (interactive; do this yourself)

cd /path/to/ai-sdlc
git add -A && git commit -m "Initial import"    # if not already committed
gh repo create ai-sdlc --private --source=. --remote=origin --push

# Branch protection: require 1 approving review + the CI status check.
OWNER=$(gh api user --jq .login)
gh api -X PUT "repos/$OWNER/ai-sdlc/branches/main/protection" \
  -H "Accept: application/vnd.github+json" \
  -f 'required_pull_request_reviews[required_approving_review_count]=1' \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[contexts][]=ai-sdlc-e2e' \
  -F 'enforce_admins=false' -F 'restrictions=' 2>/dev/null || \
  echo "Note: branch protection requires a repo plan that supports it for private repos."
```

**Why a posted commit status (enforcement A):** Jenkins runs on `localhost`, which GitHub
cannot reach, so GitHub can't observe the build directly. Instead, stage 5
(`jenkins-integration`) reads the local Jenkins result and **posts** a `ai-sdlc-e2e`
commit status to the branch tip via `gh api`. Branch protection then requires that
context plus the human approval — both enforced server-side.

---

## 3. Jenkins job — `ai-sdlc-e2e` (Pipeline from SCM)

The job clones the app repo and runs its root `Jenkinsfile` for the branch passed as `BRANCH`.
Created via `config.xml` (see `scripts/jenkins-job-config.xml` — `__REPO_URL__` = the app
repo, `scriptPath` = `Jenkinsfile`), posted with:

```bash
TOK=$(cat "$HOME/ai-sdlc-stack/admin-api-token.txt")
curl -u "admin:$TOK" -H "Content-Type: application/xml" \
  --data-binary @scripts/jenkins-job-config.xml \
  "http://localhost:8080/createItem?name=ai-sdlc-e2e"
```

The job's Git remote is the GitHub repo (so it can check out feature branches after push).

---

## 4. Environment (`.env`)

```bash
cp .env.example .env
```
Set (only `.env`, never committed):
```
JENKINS_URL=http://localhost:8080
JENKINS_USER=admin
JENKINS_TOKEN=<contents of ~/ai-sdlc-stack/admin-api-token.txt>
JENKINS_JOB=ai-sdlc-e2e
GITHUB_TOKEN=<gh auth token — `gh auth token`>
# Jira is simulated locally → no JIRA_* needed.
```
Load before launching Claude Code: `set -a; source .env; set +a`.

---

## 5. Simulated Jira

Requirements live as `tickets/<JIRA-ID>.md` at the repo root. `jira-intake` (stage 1)
uses that file when present, before trying any Jira MCP. See `tickets/DEMO-1.md`.
To add work: drop a new `tickets/<KEY>.md` with a summary + `## Acceptance Criteria`.

---

## 6. Run the pipeline

```bash
node bin/validate.js          # 19 checks pass
claude                        # launch Claude Code in the repo
```
In Claude Code:
```
/sdlc:run DEMO-1              # full pipeline: intake → implement → verify → automate → run-ci → ship
```
Stage 6 opens a PR and **pauses at "awaiting approval"**. Approve the PR in GitHub, then:
```
/sdlc:ship DEMO-1            # merges on green + approved
```

---

## Operating the stack

- **Start Jenkins:** the `java -jar jenkins.war` command in §1d (keep it running).
- **Stop Jenkins:** `pkill -f jenkins.war`.
- **Jenkins data / reset:** everything is under `~/ai-sdlc-stack/jenkins` — delete it to start clean.
- **Logs:** the console of the running Jenkins process, or `~/ai-sdlc-stack/jenkins/logs`.
- **Admin token:** `~/ai-sdlc-stack/admin-api-token.txt`.

## Swapping in real infrastructure later

- **Real Jira:** authorize the Atlassian connector; remove the local `tickets/<ID>.md` and
  the skill falls back to the Jira MCP automatically.
- **Real Jenkins:** point `JENKINS_URL`/`JENKINS_USER`/`JENKINS_TOKEN` at the server and
  recreate the job there. If Jenkins is internet-reachable, wire its native GitHub status
  reporting and drop the posted-status step.
- **Real product repo:** register it in `plugins/ai-sdlc/config/repos.yaml` and set its
  Jenkins job in `plugins/ai-sdlc/config/pipeline.yaml`.

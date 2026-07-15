#!/usr/bin/env bash
# AI-SDLC local stack — keep the three services up: app viewer, Jenkins, dashboard.
#   ./bin/stack.sh up      start any that aren't running
#   ./bin/stack.sh down    stop all
#   ./bin/stack.sh status  show what's up
#
# Ports:  app viewer 3200 · Jenkins 8080 · dashboard 4000
# (CI/Jenkins builds use 3000 transiently, so the always-on app deliberately uses 3200.)
set -uo pipefail

STACK="$HOME/ai-sdlc-stack"
LOGS="$STACK/logs"; mkdir -p "$LOGS"
REPO="$(cd "$(dirname "$0")/.." && pwd)"       # the ai-sdlc plugin repo
VIEW="$STACK/app-viewer"                         # clone of ai-sdlc-demo-app (main)
DASH="$REPO/dashboard"
JH="$STACK/jenkins"; WAR="$STACK/jenkins.war"
APP_PORT=3200; JENKINS_PORT=8080; DASH_PORT=4000

java21() { echo "$(brew --prefix 2>/dev/null)/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/java"; }
up_on()  { curl -sS -o /dev/null --max-time 3 "http://localhost:$1" 2>/dev/null && return 0 || return 1; }
pidfile(){ echo "$STACK/$1.pid"; }

start_svc() { # name  port  workdir  command...
  local name=$1 port=$2 wd=$3; shift 3
  if up_on "$port"; then echo "  ✓ $name already up (:$port)"; return; fi
  ( cd "$wd" && nohup "$@" >"$LOGS/$name.log" 2>&1 & echo $! >"$(pidfile "$name")" )
  # wait briefly for the port to answer
  for _ in $(seq 1 40); do up_on "$port" && break; sleep 0.5; done
  if up_on "$port"; then echo "  ✓ $name started (:$port)"; else echo "  ✗ $name failed — see $LOGS/$name.log"; fi
}

cmd_up() {
  echo "Bringing up the AI-SDLC stack…"
  # keep the viewer on the latest merged main (best effort; only affects a fresh start)
  git -C "$VIEW" pull -q origin main 2>/dev/null || true
  # Jenkins
  if up_on "$JENKINS_PORT/login"; then echo "  ✓ Jenkins already up (:$JENKINS_PORT)"; else
    JENKINS_HOME="$JH" nohup "$(java21)" -Djenkins.install.runSetupWizard=false -jar "$WAR" --httpPort=$JENKINS_PORT \
      >"$LOGS/jenkins.log" 2>&1 & echo $! >"$(pidfile jenkins)"
    for _ in $(seq 1 60); do up_on "$JENKINS_PORT/login" && break; sleep 1; done
    up_on "$JENKINS_PORT/login" && echo "  ✓ Jenkins started (:$JENKINS_PORT)" || echo "  ✗ Jenkins failed — see $LOGS/jenkins.log"
  fi
  # App viewer (main of ai-sdlc-demo-app) on 3200
  DEMO_APP_PORT=$APP_PORT start_svc app "$APP_PORT/health" "$VIEW" env DEMO_APP_PORT=$APP_PORT node src/server.js
  # Dashboard on 4000
  start_svc dashboard "$DASH_PORT/api/health" "$DASH" node server.js
  echo; cmd_status
}

cmd_down() {
  echo "Stopping the AI-SDLC stack…"
  for name in dashboard app jenkins; do
    local pf; pf="$(pidfile "$name")"
    if [ -f "$pf" ]; then kill "$(cat "$pf")" 2>/dev/null && echo "  ✓ stopped $name"; rm -f "$pf"; fi
  done
  # belt-and-suspenders by port
  lsof -ti:$DASH_PORT -ti:$APP_PORT 2>/dev/null | xargs kill 2>/dev/null
  pkill -f "jenkins.war" 2>/dev/null && echo "  ✓ stopped Jenkins (war)"
  echo "done."
}

cmd_status() {
  echo "Stack status:"
  up_on "$APP_PORT/health"     && echo "  ● app        http://localhost:$APP_PORT        UP"   || echo "  ○ app        http://localhost:$APP_PORT        down"
  up_on "$JENKINS_PORT/login"  && echo "  ● jenkins    http://localhost:$JENKINS_PORT        UP"|| echo "  ○ jenkins    http://localhost:$JENKINS_PORT        down"
  up_on "$DASH_PORT/api/health"&& echo "  ● dashboard  http://localhost:$DASH_PORT        UP"  || echo "  ○ dashboard  http://localhost:$DASH_PORT        down"
}

case "${1:-status}" in
  up) cmd_up ;;
  down) cmd_down ;;
  status) cmd_status ;;
  *) echo "usage: $0 {up|down|status}"; exit 1 ;;
esac

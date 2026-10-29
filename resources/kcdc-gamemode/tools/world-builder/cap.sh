#!/usr/bin/env bash
# cap.sh <out.png>: capture the viewport and save a 1200-wide copy
out=$1
id=$(curl -s -m 30 -X POST http://127.0.0.1:7781/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "MCP-Protocol-Version: 2025-11-25" -d '{"jsonrpc":"2.0","id":"q","method":"tools/call","params":{"name":"wb_capture_viewport","arguments":{"includeOverlays":false}}}' | python -c "import json,sys; print(json.load(sys.stdin)['result']['structuredContent']['captureId'])")
sleep 2
curl -s -m 60 -X POST http://127.0.0.1:7781/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "MCP-Protocol-Version: 2025-11-25" -d "{\"jsonrpc\":\"2.0\",\"id\":\"c\",\"method\":\"tools/call\",\"params\":{\"name\":\"wb_capture_viewport\",\"arguments\":{\"captureId\":\"$id\"}}}" -o cap.raw
python -c "
import json,base64,sys
from PIL import Image
d=json.loads(open('cap.raw',encoding='utf-8').read())
img=[c for c in d['result']['content'] if c['type']=='image'][0]
open('$out','wb').write(base64.b64decode(img['data']))
im=Image.open('$out'); im.thumbnail((1200,1200)); im.save('$out')
print('$out', im.size)
"

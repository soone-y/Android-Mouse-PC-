from pathlib import Path
import base64,re
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'
def bundle_module(rel):
 p=root/rel
 code=p.read_text()
 def replace(m):
  target=(p.parent/m.group(2)).resolve().relative_to(root)
  inner=bundle_module(target)
  return m.group(1)+'data:text/javascript;base64,'+base64.b64encode(inner.encode()).decode()+m.group(3)
 return re.sub(r"(from\s+['\"])(\.[^'\"]+)(['\"])",replace,code)
def inline_html():
 html=(root/'index.html').read_text()
 css=(root/'css/styles.css').read_text()
 app=bundle_module('src/app.js')
 html=html.replace('<link rel="stylesheet" href="./css/styles.css">','<style>'+css+'</style>')
 html=html.replace('<script type="module" src="./src/app.js"></script>','<script type="module">import "data:text/javascript;base64,'+base64.b64encode(app.encode()).decode()+'"</script>')
 return html
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1120,'height':870},accept_downloads=True)
 errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content(inline_html(),wait_until='load')
 page.wait_for_timeout(300)
 page.screenshot(path=str(root/'preview.png'),full_page=True)
 page.locator('#simulate').click()
 page.wait_for_timeout(170)
 assert 'サンプル' in page.locator('#graphInfo').inner_text()
 assert page.locator('#accGraph').evaluate('(c) => c.width > 200')
 assert page.locator('#velocityGraph').evaluate('(c) => c.height > 100')
 page.locator('#graphWindow').select_option('all')
 page.screenshot(path=str(root/'preview.png'),full_page=True)
 page.locator('#graphAxis').select_option('y')
 assert '模擬' in page.locator('#status').inner_text()
 print('simulated forward',page.locator('#x').inner_text(),page.locator('#speed').inner_text())
 page.locator('#simulateRound').click()
 page.wait_for_timeout(80)
 print('simulated round',page.locator('#x').inner_text(),page.locator('#speed').inner_text())
 assert abs(float(page.locator('#x').inner_text()))<2
 page.evaluate("() => {Object.defineProperty(window,'isSecureContext',{value:true,configurable:true});window.DeviceMotionEvent=class {}}")
 page.locator('#recordStart').click()
 # synthetic calibration at 60 Hz, plus burst and stationary
 page.locator('#sensorStart').click()
 print('sensor',page.locator('#status').inner_text(),'secure',page.evaluate('window.isSecureContext'),'devicemotion',page.evaluate('typeof DeviceMotionEvent'))
 t=page.evaluate('performance.now()')
 # Simulate event with attached fake DeviceMotionEvent not constructor
 page.evaluate('''async () => {
   for (let i=0;i<155;i++) {
     const ev=new Event('devicemotion');
     Object.defineProperty(ev,'accelerationIncludingGravity',{value:{x:0,y:0,z:9.80665}});
     Object.defineProperty(ev,'rotationRate',{value:{beta:0,gamma:0,alpha:0}});
     Object.defineProperty(ev,'acceleration',{value:{x:0,y:0,z:0}});
     Object.defineProperty(ev,'interval',{value:16});
     window.dispatchEvent(ev);
     await new Promise(resolve=>setTimeout(resolve,10));
   }
 }''')
 page.locator('#calibrate').click()
 page.wait_for_timeout(50)
 page.evaluate('''async () => {
   for (let i=0;i<90;i++) {
     const ev=new Event('devicemotion');
     Object.defineProperty(ev,'accelerationIncludingGravity',{value:{x:0,y:0,z:9.80665}});
     Object.defineProperty(ev,'rotationRate',{value:{beta:0,gamma:0,alpha:0}});
     Object.defineProperty(ev,'acceleration',{value:{x:0,y:0,z:0}});
     Object.defineProperty(ev,'interval',{value:16});
     window.dispatchEvent(ev);
     await new Promise(resolve=>setTimeout(resolve,17));
   }
 }''')
 print('cal',page.locator('#calInfo').inner_text())
 page.locator('#recordStop').click()
 assert not page.locator('#csv').is_disabled()
 with page.expect_download() as info: page.locator('#csv').click()
 download=info.value;download.save_as(root/'tests'/'test_export.csv')
 page.locator('#importCsv').set_input_files(str(root/'tests'/'test_export.csv'))
 page.locator('#replay').click()
 print('replay',page.locator('#replayInfo').inner_text()[:200])
 assert 'サンプルを再積分' in page.locator('#replayInfo').inner_text()
 page.locator('#graphReplayTrack').select_option('nominal')
 assert not page.locator('#graphReplayOption').is_hidden()
 assert 'CSV再生' in page.locator('#graphInfo').inner_text()
 print('errors',errors)
 assert not errors,errors
 browser.close()
server.shutdown()

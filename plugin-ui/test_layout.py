"""Exercise actual packaged JS and assert the left/top viewport reservation."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent
RESULTS = ROOT / 'screenshots'
RESULTS.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
server = ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}/'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        context = browser.new_context(viewport={'width':1366,'height':768})
        context.add_init_script(path=str(ROOT/'mock-room.js'))
        errors = []
        pages = []
        def user(index):
            page = context.new_page()
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.goto(base+f'?id=u{index}')
            return page
        pages = [user(i) for i in range(3)]
        admin = pages[0]
        admin.get_by_role('button',name='参加募集を開始',exact=True).click()
        admin.get_by_role('button',name='参加する',exact=True).click()
        for page in pages[1:]:
            page.get_by_role('button',name='参加する',exact=True).click()
        expect(admin.locator('.on-roster-person')).to_have_count(3)
        admin.get_by_role('button',name='対戦開始',exact=True).click()
        for page in pages: expect(page.locator('.on-root')).to_have_attribute('data-state','playing')
        assert [page.locator('.df-hand .df-card').count() for page in pages] == [18,18,17]
        for page in pages:
            page.wait_for_function("[...document.querySelectorAll('.df-hand img')].every(image=>image.complete&&image.naturalWidth>0)")

        def fits(page,width,height,tag):
            page.set_viewport_size({'width':width,'height':height})
            page.screenshot(path=str(RESULTS/f'{tag}-{width}x{height}.png'))
            metrics=page.locator('.df-panel').evaluate('''panel=>{
                const root=panel.parentElement.getBoundingClientRect();
                return {root:{x:root.x,y:root.y,width:root.width,height:root.height},
                    sections:[panel,...panel.querySelectorAll('.df-header,.df-game,.df-game-layout,.df-play-area,.df-card-table,.on-table,.on-opponents,.on-center,.df-hand-section,.df-hand,.df-controls')].map(e=>({
                        name:e.className,w:e.clientWidth,h:e.clientHeight,sw:e.scrollWidth,sh:e.scrollHeight
                    }))};
            }''')
            r=metrics['root']
            assert abs(r['x'])<1 and abs(r['y'])<1, r
            assert abs(r['width']-width*.6)<1 and abs(r['height']-height*.8)<1, r
            assert page.evaluate('''!document.elementFromPoint(innerWidth*.8,innerHeight*.4).closest('.on-root') && !document.elementFromPoint(innerWidth*.3,innerHeight*.9).closest('.on-root')'''), 'Chat or lower room controls are covered'
            for m in metrics['sections']:
                assert m['sw']<=m['w']+1 and m['sh']<=m['h']+1,(width,height,m)
            assert page.locator('.df-hand .df-card').evaluate_all('''cards=>cards.every(c=>{
                const r=c.getBoundingClientRect(), panel=c.closest('.df-panel').getBoundingClientRect();
                const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
                return r.x>=0 && r.y>=0 && r.right<=panel.right+1 && r.bottom<=panel.bottom+1 && (hit===c||c.contains(hit));
            })'''),(width,height,'card covered or outside reserved area')
            expect(page.get_by_role('button',name='カードを出す',exact=True)).to_be_in_viewport(ratio=1)
            if tag=='three' and width>=900:
                size=page.locator('.df-hand .df-card').first.bounding_box()
                assert size['width'] > height*.063*1.3, size
            print('PASS',tag,width,height,'left 60%, top 80%, no scroll or covered cards',flush=True)

        sizes=[(1366,768),(1920,1080),(1440,900),(1280,720),(1024,600),(910,564)]
        for w,h in sizes: fits(admin,w,h,'three')
        admin.set_viewport_size({'width':1366,'height':768})
        card=admin.locator('.df-hand .df-card').first
        card.click()
        expect(card).to_have_attribute('aria-pressed','true')
        admin.wait_for_timeout(6000)
        expect(card).to_have_attribute('aria-pressed','true')
        admin.get_by_role('button',name='カードを出す',exact=True).click()
        expect(admin.locator('.df-hand .df-card')).to_have_count(17)
        expect(admin.locator('.df-table-cards .df-card')).to_have_count(1)
        fits(admin,1366,768,'played')
        # Exercise the Federation entry and its standard exposed component API.
        assert admin.evaluate('''async()=>{
            const remote=await import('./remoteEntry.js');
            const factory=await remote.get('./CustomOverlay');
            const exports=factory();
            return typeof exports.CustomOverlay==='function' && exports.CustomOverlay===exports.default;
        }''')
        admin.get_by_role('button',name='対戦を終了する',exact=True).click()
        admin.get_by_role('dialog').get_by_role('button',name='終了する',exact=True).click()
        admin.get_by_role('button',name='参加募集を開始',exact=True).click()
        for i in range(3,10): pages.append(user(i))
        for index,page in enumerate(pages):
            if index==0: page.get_by_role('button',name='参加する',exact=True).click()
            else:
                invite=page.get_by_role('button',name='大富豪に参加する')
                if invite.count(): invite.click()
                else: page.get_by_role('button',name='参加する',exact=True).click()
        expect(admin.locator('.on-roster-person')).to_have_count(10)
        for w,h in sizes:
            admin.set_viewport_size({'width':w,'height':h})
            lobby=admin.locator('.on-lobby').evaluate('(e)=>({h:e.clientHeight,sh:e.scrollHeight})')
            assert lobby['sh']<=lobby['h']+1,(w,h,lobby)
            expect(admin.get_by_role('button',name='対戦開始',exact=True)).to_be_in_viewport(ratio=1)
            print('PASS lobby',w,h,'10 participants and start button fit',flush=True)
        admin.get_by_role('button',name='対戦開始',exact=True).click()
        for page in pages: expect(page.locator('.on-root')).to_have_attribute('data-state','playing')
        assert sum(page.locator('.df-hand .df-card').count() for page in pages)==53
        for w,h in sizes: fits(admin,w,h,'ten')
        assert not errors, errors
        browser.close()
        print('PASS: packaged gameplay, stable selection, play, 10-player recruitment, Federation exports and no JS errors',flush=True)
finally:
    server.shutdown()

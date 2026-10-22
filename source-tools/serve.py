#!/usr/bin/env python3
"""Serve only the demo's public assets, never the workspace or credentials."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
ROOT=Path(__file__).resolve().parents[1]/'web_app'
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def list_directory(self,path):self.send_error(404);return None
 def end_headers(self):
  self.send_header('X-Content-Type-Options','nosniff')
  self.send_header('Referrer-Policy','no-referrer')
  self.send_header('Cache-Control','no-cache')
  super().end_headers()
 def log_message(self,fmt,*args):pass
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8767);p.add_argument('--host',default='0.0.0.0');a=p.parse_args()
 print('NightLens public assets:',ROOT,flush=True);print('Listening on',a.host,a.port,flush=True)
 ThreadingHTTPServer((a.host,a.port),Handler).serve_forever()

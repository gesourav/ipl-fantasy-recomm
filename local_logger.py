import http.server
import json
import os
from datetime import datetime

PORT = 5050

class DumpHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/dump':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data)
                
                # Create dumps directory if it doesn't exist
                if not os.path.exists("dumps"):
                    os.makedirs("dumps")
                
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"dumps/player_status_{timestamp}.json"
                
                with open(filename, 'w') as f:
                    json.dump(data, f, indent=2)
                
                print(f"✅ Successfully saved player status to {filename}")
                
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'{"success": true}')
            except Exception as e:
                print(f"❌ Error saving dump: {e}")
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'{"success": false}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Suppress default HTTP server logging
        pass

if __name__ == '__main__':
    server = http.server.HTTPServer(('', PORT), DumpHandler)
    print("=========================================")
    print(f"🏏 IPL Fantasy Logger Server running")
    print(f"Listening on http://localhost:{PORT}")
    print("Waiting for analyze runs from Chrome extension...")
    print("Dumps will be saved to the 'dumps/' folder")
    print("Press Ctrl+C to stop")
    print("=========================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down logger...")
        server.server_close()

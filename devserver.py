#!/usr/bin/env python3
"""Static file server for local development.

Replaces `python3 -m http.server`, which sends Last-Modified and no
Cache-Control at all. That combination leaves the browser free to apply
heuristic caching, and on this project it failed in a way that was genuinely
hard to read: every stylesheet and script is cache-busted with a ?v= query
except index.html itself, which cannot be. So the browser kept serving a stale
index.html — and because newly added files are referenced only from it, those
files were never requested at all. The symptom was not a feature rendering
wrongly, it was a feature that did not exist in the page, which sends you
looking for a bug in code the browser had never loaded.

Two changes, both development-only and neither of any consequence to how the
site is eventually hosted:

  * every response carries Cache-Control: no-store
  * conditional request headers are stripped, so the parent class cannot answer
    304 Not Modified and hand the browser its cached copy back
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

CONDITIONAL_HEADERS = ("If-Modified-Since", "If-None-Match")


class NoCacheHandler(SimpleHTTPRequestHandler):
    def _drop_conditionals(self):
        for header in CONDITIONAL_HEADERS:
            while header in self.headers:
                del self.headers[header]

    def do_GET(self):
        self._drop_conditionals()
        super().do_GET()

    def do_HEAD(self):
        self._drop_conditionals()
        super().do_HEAD()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # The default logs every asset request; a full page load here is around
        # sixty lines of noise that buries anything worth seeing.
        if args and isinstance(args[0], str) and " /" in args[0]:
            status = str(args[1]) if len(args) > 1 else ""
            if status.startswith("2"):
                return
        super().log_message(fmt, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5270
    directory = sys.argv[2] if len(sys.argv) > 2 else "."
    handler = partial(NoCacheHandler, directory=directory)
    with ThreadingHTTPServer(("", port), handler) as httpd:
        print("dev server: http://localhost:%d  (Cache-Control: no-store)" % port)
        httpd.serve_forever()


if __name__ == "__main__":
    main()

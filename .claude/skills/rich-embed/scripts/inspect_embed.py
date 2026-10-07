#!/usr/bin/env python3
"""Read-only raw HTTP inspection; output evidence, never platform certification."""

import argparse
import hashlib
import json
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


MAX_BODY = 2 * 1024 * 1024
HEADERS = (
    "content-type", "content-length", "content-encoding", "content-security-policy",
    "content-security-policy-report-only", "x-frame-options", "cache-control",
    "location", "x-robots-tag", "permissions-policy",
)


def check_url(url):
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ValueError("Use an absolute HTTP(S) URL.")
    if parts.username is not None or parts.password is not None:
        raise ValueError("Credential-bearing URLs are not supported.")
    return url


class RedirectLog(HTTPRedirectHandler):
    def __init__(self):
        self.hops = []

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        check_url(newurl)
        self.hops.append({"status": code, "from": req.full_url, "to": newurl})
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class HeadMetadata(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_head = False
        self.in_title = False
        self.title_parts = []
        self.meta = {}
        self.canonical = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "head":
            self.in_head = True
        if not self.in_head:
            return
        if tag == "title":
            self.in_title = True
        if tag == "meta":
            name = (attrs.get("property") or attrs.get("name") or "").lower()
            if name.startswith(("og:", "twitter:")) or name in ("robots", "description"):
                self.meta.setdefault(name, []).append(attrs.get("content", ""))
        if tag == "link" and "canonical" in (attrs.get("rel") or "").lower().split():
            self.canonical.append(attrs.get("href", ""))

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "head":
            self.in_head = False

    def handle_data(self, data):
        if self.in_head and self.in_title:
            self.title_parts.append(data)


def inspect(url, user_agent, timeout, parse_html=False):
    redirects = RedirectLog()
    result = {"redirects": redirects.hops}
    try:
        check_url(url)
        result["requested_url"] = url
        request = Request(url, headers={"User-Agent": user_agent, "Accept-Encoding": "identity"})
        try:
            response = build_opener(redirects).open(request, timeout=timeout)
        except HTTPError as error:
            response = error
        with response:
            body = response.read(MAX_BODY + 1)
            result.update({
                "status": response.status,
                "final_url": response.geturl(),
                "https_final": urlsplit(response.geturl()).scheme == "https",
                "headers": {name: response.headers.get_all(name) for name in HEADERS
                            if response.headers.get_all(name)},
                "body_complete": len(body) <= MAX_BODY,
                "bytes_read": len(body),
            })
            if len(body) <= MAX_BODY:
                result["sha256"] = hashlib.sha256(body).hexdigest()
            else:
                result["note"] = "Body exceeds the 2 MiB inspection limit; metadata may be incomplete."
            if parse_html and response.headers.get_content_type() in ("text/html", "application/xhtml+xml"):
                parser = HeadMetadata()
                encoding = response.headers.get_content_charset() or "utf-8"
                try:
                    html = body[:MAX_BODY].decode(encoding, errors="replace")
                except LookupError:
                    html = body[:MAX_BODY].decode("utf-8", errors="replace")
                parser.feed(html)
                result.update({
                    "title": "".join(parser.title_parts).strip(),
                    "metadata": parser.meta,
                    "canonical": parser.canonical,
                    "repeated_metadata": [key for key, values in parser.meta.items() if len(values) > 1],
                })
    except (ValueError, OSError, URLError) as error:
        result["error"] = str(error)
    return result


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("url", help="Public share URL or an explicit local preview URL")
    args.add_argument("--resources", action="store_true", help="Also inspect the first player and image URLs")
    args.add_argument("--user-agent", default="Twitterbot/1.0")
    args.add_argument("--timeout", type=float, default=15, help="Per-request timeout in seconds (default: 15)")
    options = args.parse_args()
    if options.timeout <= 0:
        args.error("--timeout must be positive")
    share = inspect(options.url, options.user_agent, options.timeout, parse_html=True)
    report = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "user_agent": options.user_agent,
        "share": share,
        "resources": [],
        "limitations": "No browser execution, image dimension check, full CSP evaluation, or platform acceptance test.",
    }
    if options.resources:
        seen = set()
        for key in ("twitter:player", "twitter:image", "og:image"):
            values = share.get("metadata", {}).get(key, [])
            if not values or not values[0]:
                continue
            url = urljoin(share.get("final_url", options.url), values[0])
            if url in seen:
                continue
            seen.add(url)
            resource = inspect(url, options.user_agent, options.timeout)
            resource["from_metadata"] = key
            resource["declared_url"] = values[0]
            report["resources"].append(resource)
    print(json.dumps(report, indent=2, ensure_ascii=True))
    responses = [share, *report["resources"]]
    return int(any("error" in item or item.get("status", 0) >= 400 for item in responses))


if __name__ == "__main__":
    raise SystemExit(main())

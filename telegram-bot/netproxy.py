# -*- coding: utf-8 -*-
"""
netproxy.py — عبور درخواست‌های تلگرام از پروکسی SOCKS5، بدون هیچ وابستگی خارجی.

چرا لازم است؟
    در ایران api.telegram.org به IP فیلترینگ (۱۰.۱۰.۳۴.۳۵) رزولو می‌شود و
    اتصال مستقیم برقرار نمی‌شود. ربات برای کار کردن باید از پروکسی محلی
    (v2rayN / xray روی 127.0.0.1:10808) رد شود.

چرا PySocks استفاده نشده؟
    تا ربات روی هر ماشینی بدون «pip install» کار کند. دست‌دادن SOCKS5
    ساده است و همین‌جا در ~۴۰ خط پیاده شده.

نحوهٔ استفاده (در bot.py):
    import netproxy
    netproxy.install(cfg.get("proxy"))     # مثل "socks5://127.0.0.1:10808"

نکته: فقط ترافیک تلگرام از پروکسی می‌رود. Supabase و سایت مستقیم
می‌مانند تا سرعت کم نشود.
"""

import http.client
import socket
import struct
import urllib.parse
import urllib.request

# فقط این دامنه‌ها از پروکسی عبور می‌کنند
_PROXIED_HOSTS = ("api.telegram.org", "telegram.org")

_original_urlopen = urllib.request.urlopen
_installed = False
_proxy = None          # (host, port)


def _should_proxy(host):
    host = (host or "").split(":")[0].lower()
    for h in _PROXIED_HOSTS:
        if host == h or host.endswith("." + h):
            return True
    return False


def _socks5_tunnel(proxy_host, proxy_port, dest_host, dest_port, timeout):
    """اتصال TCP به مقصد از راه پروکسی SOCKS5 (بدون احراز هویت)."""
    sock = socket.create_connection((proxy_host, proxy_port), timeout)
    try:
        # ۱) خوش‌آمد: فقط روش «بدون احراز هویت»
        sock.sendall(b"\x05\x01\x00")
        reply = _recv_exact(sock, 2)
        if reply[0] != 0x05:
            raise OSError("پروکسی SOCKS5 پاسخ نامعتبر داد")
        if reply[1] != 0x00:
            raise OSError("پروکسی SOCKS5 احراز هویت می‌خواهد (پشتیبانی نمی‌شود)")

        # ۲) درخواست اتصال — نام دامنه (نه IP) تا DNS هم سمت پروکسی حل شود
        host_bytes = dest_host.encode("idna") if dest_host else b""
        if len(host_bytes) > 255:
            raise OSError("نام دامنهٔ مقصد خیلی بلند است")
        request = (b"\x05\x01\x00\x03" + bytes([len(host_bytes)]) + host_bytes
                   + struct.pack("!H", dest_port))
        sock.sendall(request)

        # ۳) پاسخ
        head = _recv_exact(sock, 4)
        if head[1] != 0x00:
            codes = {1: "خطای عمومی", 2: "اجازه داده نشد", 3: "شبکه در دسترس نیست",
                     4: "میزبان در دسترس نیست", 5: "اتصال رد شد",
                     6: "زمان تمام شد", 7: "فرمان پشتیبانی نمی‌شود",
                     8: "نوع آدرس پشتیبانی نمی‌شود"}
            raise OSError("پروکسی SOCKS5: %s" % codes.get(head[1], head[1]))

        atyp = head[3]
        if atyp == 0x01:
            _recv_exact(sock, 4)
        elif atyp == 0x03:
            n = _recv_exact(sock, 1)[0]
            _recv_exact(sock, n)
        elif atyp == 0x04:
            _recv_exact(sock, 16)
        else:
            raise OSError("پروکسی SOCKS5: نوع آدرس ناشناخته")
        _recv_exact(sock, 2)          # پورت
        return sock
    except Exception:
        try:
            sock.close()
        except Exception:
            pass
        raise


def _recv_exact(sock, n):
    buf = b""
    while len(buf) < n:
        part = sock.recv(n - len(buf))
        if not part:
            raise OSError("اتصال پروکسی قطع شد")
        buf += part
    return buf


class _SocksHTTPSConnection(http.client.HTTPSConnection):
    """HTTPS از راه SOCKS5."""

    def __init__(self, host, **kwargs):
        self._proxy = kwargs.pop("socks_proxy")
        super().__init__(host, **kwargs)

    def connect(self):
        raw = _socks5_tunnel(self._proxy[0], self._proxy[1],
                             self.host, self.port, self.timeout)
        if self._tunnel_host:
            self.sock = raw
            self._tunnel()
        self.sock = self._context.wrap_socket(raw, server_hostname=self.host)


class _SocksHTTPConnection(http.client.HTTPConnection):
    """HTTP ساده از راه SOCKS5 (برای احتیاط)."""

    def __init__(self, host, **kwargs):
        self._proxy = kwargs.pop("socks_proxy")
        super().__init__(host, **kwargs)

    def connect(self):
        self.sock = _socks5_tunnel(self._proxy[0], self._proxy[1],
                                   self.host, self.port, self.timeout)


class _SmartHTTPSHandler(urllib.request.HTTPSHandler):
    """تلگرام → پروکسی، بقیه → مستقیم."""

    def https_open(self, req):
        host = req.host or ""
        if _proxy and _should_proxy(host):
            return self.do_open(self._socks_conn, req)
        return self.do_open(self._direct_conn, req)

    def _socks_conn(self, host, **kw):
        kw["context"] = self._context
        kw["socks_proxy"] = _proxy
        return _SocksHTTPSConnection(host, **kw)

    def _direct_conn(self, host, **kw):
        kw["context"] = self._context
        return http.client.HTTPSConnection(host, **kw)


class _SmartHTTPHandler(urllib.request.HTTPHandler):
    """همان منطق برای HTTP ساده."""

    def http_open(self, req):
        host = req.host or ""
        if _proxy and _should_proxy(host):
            return self.do_open(self._socks_conn, req)
        return self.do_open(self._direct_conn, req)

    def _socks_conn(self, host, **kw):
        kw["socks_proxy"] = _proxy
        return _SocksHTTPConnection(host, **kw)

    def _direct_conn(self, host, **kw):
        return http.client.HTTPConnection(host, **kw)


def parse_proxy(value):
    """'socks5://127.0.0.1:10808' یا '127.0.0.1:10808' → (host, port)"""
    if not value:
        return None
    raw = str(value).strip()
    if "://" not in raw:
        raw = "socks5://" + raw
    parts = urllib.parse.urlsplit(raw)
    host = parts.hostname or "127.0.0.1"
    port = parts.port or 10808
    return (host, int(port))


def install(proxy_value, logger=None):
    """
    پروکسی را فعال می‌کند. اگر مقدار خالی باشد، تلاش می‌کند پروکسی
    محلی رایج را خودش پیدا کند.
    """
    global _installed, _proxy

    proxy = parse_proxy(proxy_value)
    if proxy is None:
        proxy = _autodetect()

    if proxy is None:
        if logger:
            logger("پروکسی پیدا نشد — اتصال مستقیم به تلگرام")
        return False

    # اگر پروکسی در دسترس نیست، مستقیم کار کن (شاید فیلتر نباشد)
    try:
        s = socket.create_connection(proxy, timeout=2)
        s.close()
    except Exception as exc:  # noqa: BLE001
        if logger:
            logger("پروکسی %s:%s در دسترس نیست (%s) — اتصال مستقیم" % (proxy[0], proxy[1], exc))
        return False

    _proxy = proxy
    if not _installed:
        opener = urllib.request.build_opener(_SmartHTTPSHandler, _SmartHTTPHandler)
        opener.addheaders = [("User-Agent", "KosarTadilatBot/1.0")]
        urllib.request.urlopen = opener.open
        _installed = True

    if logger:
        logger("پروکسی فعال شد: %s:%s (فقط برای تلگرام)" % proxy)
    return True


def _autodetect():
    """پورت‌های رایج v2rayN / xray / clash را امتحان می‌کند."""
    for host, port in (("127.0.0.1", 10808), ("127.0.0.1", 10809),
                       ("127.0.0.1", 1080), ("127.0.0.1", 2080),
                       ("127.0.0.1", 7890)):
        try:
            s = socket.create_connection((host, port), timeout=0.4)
            s.close()
            return (host, port)
        except Exception:  # noqa: BLE001
            continue
    return None


def active():
    return _proxy

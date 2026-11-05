"""Writes a minimal BundleConfig.pb (bundletool config.proto) for a hand-built AAB."""
import sys

def field_bytes(num, payload):
    return bytes([(num << 3) | 2]) + varint(len(payload)) + payload

def varint(n):
    out = b""
    while True:
        b = n & 0x7F
        n >>= 7
        if n:
            out += bytes([b | 0x80])
        else:
            return out + bytes([b])

bundletool = field_bytes(2, b"1.17.2")          # Bundletool.version
config = field_bytes(1, bundletool)              # BundleConfig.bundletool
open(sys.argv[1], "wb").write(config)

"""Resolve the Xcode the user has switched to, and read its versions.

Preference order: an explicit ``AXIOM_XCODE_PATH`` override; then what
``xcode-select -p`` reports, which honors ``DEVELOPER_DIR`` (as the ``.app`` or its
``Contents/Developer``) and otherwise the ``xcode-select --switch`` selection; then
that selection alone, when ``DEVELOPER_DIR`` names something that is not an Xcode;
then the default app path. That is xcrun's precedence, except that xcrun fails on
(or uses) a ``DEVELOPER_DIR`` that names no Xcode, where this falls back to the
selection. A candidate counts only when it has a ``Contents/Info.plist``, so a
Command Line Tools selection falls through instead of claiming a toolchain it lacks.

axiom-pi and axiom-mcp port this in version-context.ts;
scripts/version-context.test.ts holds the two to the same answers.
"""
from __future__ import annotations

import os
import plistlib
import subprocess
from typing import Callable, Mapping, NamedTuple, Optional

DEFAULT_XCODE_PATH = "/Applications/Xcode.app"
# Absolute, so a project's bin directory on PATH cannot stand in for it.
XCODE_SELECT = "/usr/bin/xcode-select"
IOS_SDK_SETTINGS = (
    "Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk/SDKSettings.plist"
)


class Toolchain(NamedTuple):
    path: str
    xcode_version: Optional[str]
    ios_sdk_version: Optional[str]


def run_xcode_select(env: Mapping[str, str]) -> str | None:
    """`xcode-select -p` under env, or None when it fails, is absent, or cannot be
    spawned (a NUL byte in env raises ValueError). Decoded as UTF-8, not the
    locale's codec, so a non-ASCII path survives an ASCII locale."""
    try:
        out = subprocess.run([XCODE_SELECT, "-p"], env=dict(env), capture_output=True, timeout=1)
    except (OSError, ValueError, subprocess.SubprocessError):
        return None
    path = out.stdout.decode("utf-8", "surrogateescape").strip()
    return path if out.returncode == 0 and path else None


def xcode_app(developer_dir: str) -> str | None:
    """The Xcode.app that a reported developer dir is, or belongs to."""
    path = os.path.abspath(developer_dir)
    for candidate in (path, os.path.dirname(os.path.dirname(path))):
        if os.path.isfile(os.path.join(candidate, "Contents", "Info.plist")):
            return candidate
    return None


def resolve_xcode_path(
    env: Mapping[str, str],
    xcode_select: Callable[[Mapping[str, str]], str | None] = run_xcode_select,
    default: str = DEFAULT_XCODE_PATH,
) -> str:
    explicit = env.get("AXIOM_XCODE_PATH")
    if explicit:
        return explicit
    lookups = [env]
    if env.get("DEVELOPER_DIR"):
        lookups.append({k: v for k, v in env.items() if k != "DEVELOPER_DIR"})
    for lookup_env in lookups:
        developer_dir = xcode_select(lookup_env)
        app = xcode_app(developer_dir) if developer_dir else None
        if app:
            return app
    return default


def plist_string(path: str, key: str) -> str | None:
    """A string value from a plist, or None if the file or key is missing."""
    try:
        with open(path, "rb") as f:
            value = plistlib.load(f).get(key)
    except Exception:
        return None
    return value if isinstance(value, str) and value else None


def detect_toolchain(
    env: Mapping[str, str],
    xcode_select: Callable[[Mapping[str, str]], str | None] = run_xcode_select,
) -> Toolchain:
    """The resolved Xcode and its versions, read from plists (no xcodebuild)."""
    path = resolve_xcode_path(env, xcode_select)
    return Toolchain(
        path,
        plist_string(os.path.join(path, "Contents", "Info.plist"), "CFBundleShortVersionString"),
        plist_string(os.path.join(path, IOS_SDK_SETTINGS), "Version"),
    )

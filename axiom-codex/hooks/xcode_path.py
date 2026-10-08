"""Resolve which Xcode the session should describe.

Preference order: an explicit ``AXIOM_XCODE_PATH`` override, then ``DEVELOPER_DIR``
(the toolchain the session would actually build with), then the ``xcode-select``
target, then the default app path. Each candidate is validated by its
``Contents/Info.plist`` and falls through when absent, so a machine with only
Command Line Tools resolves to the default instead of claiming a toolchain it
does not have.
"""
from __future__ import annotations

import os

SELECT_LINK = "/var/db/xcode_select_link"
DEFAULT_XCODE_PATH = "/Applications/Xcode.app"


def _app_from_developer_dir(developer_dir: str) -> str | None:
    """The Xcode.app a Developer dir belongs to, when it looks like an Xcode."""
    app = os.path.dirname(os.path.dirname(developer_dir.rstrip("/")))
    if os.path.isfile(os.path.join(app, "Contents", "Info.plist")):
        return app
    return None


def resolve_xcode_path(
    env,
    select_link: str = SELECT_LINK,
    default: str = DEFAULT_XCODE_PATH,
) -> str:
    explicit = env.get("AXIOM_XCODE_PATH")
    if explicit:
        return explicit
    developer_dir = env.get("DEVELOPER_DIR")
    if developer_dir:
        app = _app_from_developer_dir(developer_dir)
        if app:
            return app
    try:
        target = os.readlink(select_link)
    except OSError:
        target = ""
    if target:
        app = _app_from_developer_dir(target)
        if app:
            return app
    return default

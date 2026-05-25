#!/usr/bin/env python3
"""Analyze coarse vs fine-grained CBOMs for filesystem and network permission changes.

Usage: python fine-grained-impact.py --root PATH

Scans each immediate subdirectory of PATH for `cbom.coarse.json` and `cbom.json`.
For entries that had `file-system` (coarse) or `network` (coarse) it records the
current fine-grained permissions (`fs-read`, `fs-write`, `fs-meta`, or `file-system`)
and analogous `network-*` permissions, then prints summary tables of how many
kept all permissions vs which were stripped (read/write/meta combinations).
"""

from __future__ import annotations

import argparse
import json
import os
from collections import Counter, defaultdict
from typing import Dict, Iterable, List


FS_BASE = {"fs-read", "fs-write", "fs-meta"}
NET_BASE = {"network-https", "network-http", "network-ip", "network-dns", "network-udp"}
COARSE_FS = "file-system"
COARSE_NET = "network"


def load_json(path: str):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def categorize_fs(perms: Iterable[str]) -> str:
    perms = set(perms or [])
    if COARSE_FS in perms:
        return "kept_all"
    present = FS_BASE & perms
    missing = FS_BASE - present
    if not missing:
        return "kept_all"
    # represent missing combination, e.g. "missing:fs-read+fs-write"
    return "missing:" + "+".join(sorted(missing))


def categorize_net(perms: Iterable[str]) -> str:
    perms = set(perms or [])
    if COARSE_NET in perms:
        # if coarse 'network' remains in fine-grained listing, treat as unchanged
        return "kept_all"
    present = NET_BASE & perms
    missing = NET_BASE - present
    if not missing:
        return "kept_all"
    return "missing:" + "+".join(sorted(missing))


def analyze_root(root: str):
    fs_counter = Counter()
    net_counter = Counter()
    fs_examples = defaultdict(list)
    net_examples = defaultdict(list)

    for entry in sorted(os.listdir(root)):
        sub = os.path.join(root, entry)
        if not os.path.isdir(sub):
            continue

        coarse_path = os.path.join(sub, "cbom.coarse.json")
        fine_path = os.path.join(sub, "cbom.json")
        coarse = load_json(coarse_path)
        fine = load_json(fine_path)
        if not coarse or not fine:
            continue

        # coarse and fine are both mapping package@ver -> [perms]
        for pkg, coarse_perms in coarse.items():
            if not isinstance(coarse_perms, list):
                continue

            # FILESYSTEM group
            if COARSE_FS in coarse_perms:
                fine_perms = fine.get(pkg, [])
                label = categorize_fs(fine_perms)
                fs_counter[label] += 1
                if len(fs_examples[label]) < 5:
                    fs_examples[label].append((entry, pkg))

            # NETWORK group
            if COARSE_NET in coarse_perms:
                fine_perms = fine.get(pkg, [])
                label = categorize_net(fine_perms)
                net_counter[label] += 1
                if len(net_examples[label]) < 5:
                    net_examples[label].append((entry, pkg))

    return fs_counter, net_counter, fs_examples, net_examples


def print_table(title: str, counter: Counter, examples: Dict[str, List], total: int = None):
    print("\n" + title)
    print("".join(["="] * len(title)))
    if total is None:
        total = sum(counter.values())
    print(f"Total items: {total}")
    print()
    print("{:<40} {:>6}  {}".format("Category", "Count", "Examples"))
    print("-" * 80)
    for k, v in counter.most_common():
        ex = ", ".join([f"{d}/{p}" for d, p in examples.get(k, [])])
        print(f"{k:<40} {v:>6}  {ex}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--root", "-r", default=".", help="Root directory containing subdirectories to scan")
    args = p.parse_args()

    fs_counter, net_counter, fs_examples, net_examples = analyze_root(args.root)

    print_table("Filesystem permission changes (coarse 'file-system')", fs_counter, fs_examples)
    print_table("Network permission changes (coarse 'network')", net_counter, net_examples)


if __name__ == "__main__":
    main()

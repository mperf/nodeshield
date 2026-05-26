#!/usr/bin/env python3
"""Analyze coarse vs fine-grained CBOMs for filesystem, network, crypto, and command permission changes.

Usage: python fine-grained-impact.py --root PATH

Scans each immediate subdirectory of PATH for `cbom.coarse.json` and `cbom.json`.
For entries that had coarse permissions (`file-system`, `network`, `crypto`, `command`),
it records the current fine-grained permissions and prints summary tables of how many
kept all permissions vs which were stripped.
"""

from __future__ import annotations

import argparse
import json
import os
from collections import Counter, defaultdict
from typing import Dict, Iterable, List


# Base sets for fine-grained permissions
FS_BASE = {"fs-read", "fs-write", "fs-meta"}
NET_BASE = {"network-https", "network-http", "network-ip", "network-dns", "network-udp"}
CRYPTO_BASE = {"crypto-random", "crypto-hash", "crypto-key", "crypto-cryptoops"}
CMD_BASE = {"cmd-exec", "cmd-worker"}

# Coarse permission names
COARSE_FS = "file-system"
COARSE_NET = "network"
COARSE_CRYPTO = "crypto"
COARSE_CMD = "command"


def load_json(path: str):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def categorize_perms(perms: Iterable[str], coarse_name: str, base_set: set) -> str:
    """Generic categorization function to determine which sub-capabilities were stripped."""
    perms = set(perms or [])
    if coarse_name in perms:
        # if coarse permission remains in fine-grained listing, treat as unchanged
        return "kept_all"
    
    present = base_set & perms
    missing = base_set - present
    
    if not missing:
        return "kept_all"
    
    # represent missing combination, e.g. "missing:fs-read+fs-write"
    return "missing:" + "+".join(sorted(missing))


def analyze_root(root: str):
    counters = {
        "fs": Counter(),
        "net": Counter(),
        "crypto": Counter(),
        "cmd": Counter()
    }
    examples = {
        "fs": defaultdict(list),
        "net": defaultdict(list),
        "crypto": defaultdict(list),
        "cmd": defaultdict(list)
    }

    # Configuration for iterating through capability groups
    targets = [
        (COARSE_FS, FS_BASE, "fs"),
        (COARSE_NET, NET_BASE, "net"),
        (COARSE_CRYPTO, CRYPTO_BASE, "crypto"),
        (COARSE_CMD, CMD_BASE, "cmd")
    ]

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
                
            fine_perms = fine.get(pkg, [])

            # Check each capability group dynamically
            for coarse_name, base_set, key in targets:
                if coarse_name in coarse_perms:
                    label = categorize_perms(fine_perms, coarse_name, base_set)
                    counters[key][label] += 1
                    
                    if len(examples[key][label]) < 5:
                        examples[key][label].append((entry, pkg))

    return counters, examples


def print_table(title: str, counter: Counter, examples: Dict[str, List], total: int = None):
    print("\n" + title)
    print("".join(["="] * len(title)))
    if total is None:
        total = sum(counter.values())
    print(f"Total items: {total}")
    print()
    print("{:<55} {:>6}  {}".format("Category", "Count", "Examples"))
    print("-" * 110)
    for k, v in counter.most_common():
        ex = ", ".join([f"{d}/{p}" for d, p in examples.get(k, [])])
        print(f"{k:<55} {v:>6}  {ex}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--root", "-r", default=".", help="Root directory containing subdirectories to scan")
    args = p.parse_args()

    counters, examples = analyze_root(args.root)

    print_table("Filesystem permission changes (coarse 'file-system')", counters["fs"], examples["fs"])
    print_table("Network permission changes (coarse 'network')", counters["net"], examples["net"])
    print_table("Crypto permission changes (coarse 'crypto')", counters["crypto"], examples["crypto"])
    print_table("Command permission changes (coarse 'command')", counters["cmd"], examples["cmd"])


if __name__ == "__main__":
    main()
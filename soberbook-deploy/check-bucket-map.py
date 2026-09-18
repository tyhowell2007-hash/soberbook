#!/usr/bin/env python3
"""
THE BUCKET MAP EXISTS IN THREE PLACES AND THEY MUST AGREE.  6 Sept.

  app/api/photo/finalize/route.js   decides which bucket a new file goes in
  lib/sign-photos.js                decides which view may vouch for a path
  app/api/admin/sweep/route.js      decides which buckets get cleaned up

FOUR, as of 18 Sept:

  app/api/photo/upload-url/route.js  decides which kinds may be uploaded AT ALL

That fourth one was missing from this check and it cost stories a silent
break. PhotoUpload calls upload-url FIRST and finalize second, so a kind
absent there never reaches finalize — the upload dies on "Unknown upload
kind." and the three files this script compares still agree perfectly
with each other. The check passed, printed 11 buckets, and the feature
was completely broken. A check that cannot fail is not a check; this one
could fail, it just wasn't looking at the right door.

That is the 0046 -> 0049 shape — one rule written three times — and on
6 Sept the third copy was found four entries short. comment-photos,
dm-photos, room-videos and dm-videos had shipped on the 5th with pickers,
routes and a signer, and the sweeper had never heard of any of them.

The failure is SILENT and it is slow: an unlisted bucket is simply never
touched, so orphans accumulate for as long as nobody looks. Nothing errors.
Nothing alerts. The bill just grows, and egress on this project has already
touched 159% of the free tier once.

⚠️ THE ORDER STILL MATTERS AND THIS CHECK DOES NOT REPLACE IT.
referenced_media() must know a bucket's columns BEFORE that bucket is added
to the sweeper — an incomplete answer there does not look like an error, it
looks like a helpful list of files to delete (0063). This script only proves
the three JS copies agree; it cannot see the database.

Exit code 1 on any disagreement. Run it after touching any of the three.
"""

import re
import sys
import os

ROOT = os.path.dirname(os.path.abspath(__file__))

# quarantine is handled by its own branch in the sweeper with a 48h grace
# rather than through BUCKETS, and nothing is ever signed out of it or
# finalized into it as a destination. It is deliberately outside this map.
EXEMPT = {'quarantine'}


def strip_comments(src):
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    return re.sub(r'^\s*//.*$', '', src, flags=re.M)


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as fh:
        return strip_comments(fh.read())


def finalize_map():
    """{ bucket: 'post-photos', prefix: 'posts', ... } in the KINDS tables."""
    s = read('app/api/photo/finalize/route.js')
    return {m.group(1): m.group(2) + '/'
            for m in re.finditer(r"bucket:\s*'([a-z-]+)',\s*prefix:\s*'([a-z]+)'", s)}


def signer_map():
    """[['post-photos', 'posts/'], ...] in the signing loop."""
    s = read('lib/sign-photos.js')
    return {m.group(1): m.group(2)
            for m in re.finditer(r"\['([a-z-]+)',\s*'([a-z]+/)'\]", s)}


def sweeper_map():
    """{ bucket: 'post-photos', prefix: 'posts', grace: ... } in BUCKETS."""
    s = read('app/api/admin/sweep/route.js')
    return {m.group(1): m.group(2) + '/'
            for m in re.finditer(r"bucket:\s*'([a-z-]+)',\s*prefix:\s*'([a-z]+)'", s)}


def main():
    maps = {'finalize': finalize_map(), 'signer': signer_map(), 'sweeper': sweeper_map()}
    for name, m in maps.items():
        if not m:
            print(f'  FAIL: read 0 entries out of {name} — the regex has drifted, '
                  f'which is a broken check, not a passing one')
            return 1

    every = set()
    for m in maps.values():
        every |= set(m) - EXEMPT

    problems = []
    for bucket in sorted(every):
        seen = {name: m.get(bucket) for name, m in maps.items()}
        missing = [n for n, v in seen.items() if v is None]
        prefixes = {v for v in seen.values() if v is not None}
        if missing:
            problems.append(f'{bucket}: absent from {", ".join(missing)}')
        elif len(prefixes) > 1:
            problems.append(f'{bucket}: prefixes disagree {seen}')

    for p in problems:
        print('  MISMATCH:', p)

    print(f'  {len(every)} buckets, {len(problems)} disagreements '
          f'(finalize {len(maps["finalize"])}, signer {len(maps["signer"])}, '
          f'sweeper {len(maps["sweeper"]) - len(EXEMPT & set(maps["sweeper"]))})')
    return 1 if problems else 0


def kinds_in(path, var='KINDS'):
    src = strip_comments(open(os.path.join(ROOT, path)).read())
    i = src.index(f'const {var} = {{')
    body = src[i:src.index('\n};', i)]
    return set(re.findall(r'^\s*([a-zA-Z]+)\s*:', body, re.M))


def door_check():
    """THE FOURTH FILE. Every kind finalize can handle must also be a kind
    upload-url will issue a URL for, or the upload dies at the door and
    the three files above still agree perfectly with one another."""
    fin = kinds_in('app/api/photo/finalize/route.js') \
        | kinds_in('app/api/photo/finalize/route.js', 'VIDEO_KINDS')
    door = kinds_in('app/api/photo/upload-url/route.js')

    # The control, first: if this cannot see the door at all, everything
    # below is a check that cannot fail, which is worse than no check.
    if not door:
        print('  CONTROL FAILED: cannot read upload-url KINDS at all')
        return 1

    missing = fin - door
    if missing:
        print(f'  DOOR MISMATCH: upload-url refuses {sorted(missing)} — '
              'finalize handles them but nothing can be uploaded as one')
        return 1
    print(f'  {len(fin)} upload kinds, all accepted by upload-url')
    return 0


if __name__ == '__main__':
    rc = main()
    rc = door_check() or rc
    sys.exit(rc)

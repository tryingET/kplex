"""Verify every archived entry, inventory, byte length, SHA-256 and ZIP CRC."""
import hashlib, json, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    assert archive.testzip() is None, 'ZIP CRC failure'
    manifest=json.loads(archive.read('MANIFEST.json'))
    expected=set(manifest['files'])|{'MANIFEST.json','SHA256SUMS'}
    assert len(archive.namelist())==len(expected) and set(archive.namelist())==expected, 'Inventory mismatch'
    for name, fact in manifest['files'].items():
        data=archive.read(name)
        assert len(data)==fact['bytes'] and hashlib.sha256(data).hexdigest()==fact['sha256'], name
    for line in archive.read('SHA256SUMS').decode().splitlines():
        digest,name=line.split('  ',1)
        assert hashlib.sha256(archive.read(name)).hexdigest()==digest, name
    print(json.dumps({'verifiedEntries':len(expected),'payloadBytes':sum(x['bytes'] for x in manifest['files'].values()),'source':manifest['source']}))

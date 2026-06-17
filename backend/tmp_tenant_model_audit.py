import pathlib
schema_text = pathlib.Path('backend/prisma/schema.prisma').read_text()
models = [m.group(1) for m in __import__('re').finditer(r'^model\s+(\w+)\s+\{', schema_text, flags=__import__('re').MULTILINE)]
text = pathlib.Path('backend/src/lib/tenantPrisma.ts').read_text()
start = text.index('const TENANT_MODELS = new Set([')
end = text.index('] as const', start)
block = text[start:end]
outs = [m.group(1) for m in __import__('re').finditer(r ([A-Za-z0-9_]+) , block)]
missing = [m for m in models if m[0].islower() and m not in outs]
extra = [m for m in outs if m not in models]
print('models=', models)
print('tenant_models=', outs)
print('missing=', missing)
print('extra=', extra)

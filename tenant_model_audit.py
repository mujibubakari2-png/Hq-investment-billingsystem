import re
from pathlib import Path
schema = Path('backend/prisma/schema.prisma').read_text(encoding='utf-8')
models = re.findall(r'model\s+(\w+)\s+\{([\s\S]*?)\n\}', schema)
models_with_tenant = []
for name, body in models:
    if re.search(r'\btenantId\b', body):
        models_with_tenant.append(name)
print('TENANT_MODELS', len(models_with_tenant))
for name in models_with_tenant:
    print(name)

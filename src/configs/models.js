import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// pasta pública onde ficam os modelos 3D (.glb) e as miniaturas (.png)
export const MODELS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../public/models')

export const thumbName = glb => glb.replace(/\.glb$/i, '.png')

export async function removeModelFiles(glb) {
    if (!glb || glb !== path.basename(glb)) return
    for (const f of [glb, thumbName(glb)]) {
        await fs.unlink(path.join(MODELS_DIR, f)).catch(() => {})
    }
}

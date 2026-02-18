"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryPackager = void 0;
class InMemoryPackager {
    async build(input) {
        const id = input.ir.system.code || 'package';
        return {
            archivePath: `/tmp/${id}.tgz`,
            manifestPath: `/tmp/${id}-manifest.json`,
            sbomPath: `/tmp/${id}-sbom.json`,
            signaturePath: `/tmp/${id}-signature.sig`
        };
    }
}
exports.InMemoryPackager = InMemoryPackager;
//# sourceMappingURL=packager.js.map
const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

function withPrivacyManifest(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const projectName = config.modRequest.projectName;
      const platformRoot = config.modRequest.platformProjectRoot;
      const src = path.join(config.modRequest.projectRoot, 'PrivacyInfo.xcprivacy');
      const dstDir = path.join(platformRoot, projectName);
      const dst = path.join(dstDir, 'PrivacyInfo.xcprivacy');

      if (fs.existsSync(src)) {
        fs.mkdirSync(dstDir, { recursive: true });
        fs.copyFileSync(src, dst);
      }

      return config;
    },
  ]);
}

module.exports = withPrivacyManifest;

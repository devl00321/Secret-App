const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withPodfileFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfile = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');

      console.log('Applying Minimalist Modular Bridge fix...');

      // 1. Enable Global Modular Headers
      if (!contents.includes('use_modular_headers!')) {
        contents = `use_modular_headers!\n${contents}`;
      }

      // 3. Remove obsolete maps pod
      contents = contents.replace(/# @generated begin react-native-maps[\s\S]*?# @generated end react-native-maps/g, '');
      contents = contents.replace(/^\s*pod 'react-native-google-maps', path: .*\n/gm, '');

      // 4. Fix ambiguous dependency warnings in post_install
      if (!contents.includes('phase.always_out_of_date')) {
        contents = contents.replace(
          /post_install do \|installer\|/g,
          `post_install do |installer|
    installer.pods_project.targets.each do |target|
      target.build_phases.each do |phase|
        if phase.respond_to?(:name) && (phase.name == '[CP-User] [RNFB] Core Configuration' || phase.name == 'Create Symlinks to Header Folders')
          phase.always_out_of_date = '1'
        end
      end
    end`
        );
      }

      fs.writeFileSync(podfile, contents);
      return config;
    },
  ]);
};

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withPodfileFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfile = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');

      console.log('Applying Robust Modular Bridge, Non-Modular Header, and SwiftUICore weak-linking Fix...');

      // 1. Remove obsolete maps pod
      contents = contents.replace(/# @generated begin react-native-maps[\s\S]*?# @generated end react-native-maps/g, '');
      contents = contents.replace(/^\s*pod 'react-native-google-maps', path: .*\n/gm, '');

      // 2. Clean and replace the entire post_install block to be fully idempotent
      const postInstallRegex = /post_install do \|installer\|[\s\S]*?(?=\nend\s*$)/;
      
      const newPostInstall = `post_install do |installer|
    # Fix build settings for all targets in Pods project
    installer.pods_project.targets.each do |target|
      # 1. Allow non-modular includes (Fixes 'Include of non-modular header inside framework module')
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end

      # 2. Ambiguous dependency fix
      if target.respond_to?(:build_phases)
        target.build_phases.each do |phase|
          if phase.respond_to?(:name) && (phase.name == '[CP-User] [RNFB] Core Configuration' || phase.name == 'Create Symlinks to Header Folders')
            phase.always_out_of_date = '1'
          end
        end
      end

      # 3. Swift header visibility for FirebaseAuth and others
      if ['FirebaseAuth', 'RNFBAuth', 'FirebaseCore', 'RNFBApp'].include?(target.name)
        target.build_configurations.each do |config|
          config.build_settings['DEFINES_MODULE'] = 'YES'
          config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
        end
      end
    end

    # 6. Standard react native post install steps
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )

    # 7. Expo Build Properties: force deployment target
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.1'
      end
    end
  end`;

      contents = contents.replace(postInstallRegex, newPostInstall);

      fs.writeFileSync(podfile, contents);
      return config;
    },
  ]);
};

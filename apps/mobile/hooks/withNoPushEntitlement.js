const { withEntitlementsPlist } = require('@expo/config-plugins');

module.exports = function withNoPushEntitlement(config) {
  return withEntitlementsPlist(config, async (config) => {
    // Automatically strip the Push Notification entitlement for iOS 
    // so it builds successfully on a Free Apple Developer account.
    delete config.modResults['aps-environment'];
    return config;
  });
};

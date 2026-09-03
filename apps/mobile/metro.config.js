// Metro configured for an npm workspace.
//
// Dependencies are hoisted to the repository root, which Metro does not look in
// by default: it would resolve react-native from apps/mobile/node_modules, find
// nothing, and fail. watchFolders lets it see the root, nodeModulesPaths tells
// it where to resolve from, and disableHierarchicalLookup stops it from walking
// upwards on its own and picking up a second copy of React.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;

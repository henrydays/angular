const fs = require('fs-extra');
const glob = require('glob');
const path = require('canonical-path');
const shelljs = require('shelljs');
const yargs = require('yargs');

const SHARED_PATH = path.resolve(__dirname, 'shared');
const SHARED_NODE_MODULES_PATH = path.resolve(SHARED_PATH, 'node_modules');
const BOILERPLATE_BASE_PATH = path.resolve(SHARED_PATH, 'boilerplate');
const EXAMPLES_BASE_PATH = path.resolve(__dirname, '../../content/examples');
const TESTING_BASE_PATH = path.resolve(EXAMPLES_BASE_PATH, 'testing');

const BOILERPLATE_SRC_PATHS = [
  'src/styles.css',
  'src/systemjs-angular-loader.js',
  'src/systemjs.config.js',
  'src/tsconfig.json',
  'bs-config.json',
  'bs-config.e2e.json',
  'package.json',
  'tslint.json'
];

const BOILERPLATE_TEST_PATHS = [
  'src/browser-test-shim.js',
  'karma-test-shim.js',
  'karma.conf.js'
];

const EXAMPLE_CONFIG_FILENAME = 'example-config.json';

class ExampleBoilerPlate {
  /**
   * Add boilerplate files to all the examples
   *
   * @param useLocal if true then overwrite the Angular library files with locally built ones
   */
  add(useLocal) {
    // Install the shared `node_modules/` (if necessary overwrite Angular packages from npm with local ones).
    this.installNodeModules(SHARED_PATH, useLocal);

    // Get all the examples folders, indicated by those that contain a `example-config.json` file
    const exampleFolders = this.getFoldersContaining(EXAMPLES_BASE_PATH, EXAMPLE_CONFIG_FILENAME, 'node_modules');
    exampleFolders.forEach(exampleFolder => {

      // Link the node modules - requires admin access (on Windows) because it adds symlinks
      const destinationNodeModules = path.resolve(exampleFolder, 'node_modules');
      fs.ensureSymlinkSync(SHARED_NODE_MODULES_PATH, destinationNodeModules);

      // Copy the boilerplate source files
      BOILERPLATE_SRC_PATHS.forEach(filePath => this.copyFile(BOILERPLATE_BASE_PATH, exampleFolder, filePath));

      // Copy the boilerplate test files (if the example is configured to do unit testing)
      const exampleConfig = this.loadJsonFile(path.resolve(exampleFolder, EXAMPLE_CONFIG_FILENAME));
      if (exampleConfig.unittesting) {
        BOILERPLATE_TEST_PATHS.forEach(filePath => this.copyFile(TESTING_BASE_PATH, exampleFolder, filePath));
      }
    });
  }

  /**
   * Remove all the boilerplate files from all the examples
   */
  remove() {
    shelljs.exec('git clean -xdfq', {cwd: EXAMPLES_BASE_PATH});
  }

  main() {
    yargs
      .usage('$0 <cmd> [args]')
      .command('add [--local]', 'add the boilerplate to each example',
              { local: { describe: 'Use the locally built Angular libraries, rather than ones from  npm.' } },
              argv => this.add(argv.local))
      .command('remove', 'remove the boilerplate from each example', () => this.remove())
      .demandCommand(1, 'Please supply a command from the list above')
      .argv;
  }

  installNodeModules(basePath, useLocal) {
    const tool = 'node tools/ng-packages-installer';
    const command = useLocal ? 'overwrite' : 'restore';
    shelljs.exec([tool, command, basePath, '--debug'].join(' '));
  }

  getFoldersContaining(basePath, filename, ignore) {
    const pattern = path.resolve(basePath, '**', filename);
    const ignorePattern = path.resolve(basePath, '**', ignore, '**');
    return glob.sync(pattern, { ignore: [ignorePattern] }).map(file => path.dirname(file));
  }

  copyFile(sourceFolder, destinationFolder, filePath) {
    const sourcePath = path.resolve(sourceFolder, filePath);
    const destinationPath = path.resolve(destinationFolder, filePath);
    fs.copySync(sourcePath, destinationPath, { overwrite: true });
    fs.chmodSync(destinationPath, 444);
  }

  loadJsonFile(filePath) {
    return fs.readJsonSync(filePath, {throws: false}) || {};
  }
}

module.exports = new ExampleBoilerPlate();

// If this file was run directly then run the main function,
if (require.main === module) {
  module.exports.main();
}

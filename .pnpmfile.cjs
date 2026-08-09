module.exports = {
  hooks: {
    readPackage(pkg, context) {
      if (pkg.dependencies && pkg.dependencies.uuid) {
        pkg.dependencies.uuid = '^11.1.1';
      }
      return pkg;
    }
  }
};

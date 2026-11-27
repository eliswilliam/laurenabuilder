// Patch readFileSync to log which file causes UNKNOWN error
const fs = require('fs');
const orig = fs.readFileSync;
fs.readFileSync = function(path, ...args) {
  try {
    return orig.call(this, path, ...args);
  } catch (e) {
    if (e && e.code === 'UNKNOWN') {
      process.stderr.write('FAILED readFileSync: ' + String(path) + '\n');
    }
    throw e;
  }
};

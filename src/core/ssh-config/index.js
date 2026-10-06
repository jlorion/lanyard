'use strict';

const parser = require('./parser');
const editor = require('./editor');
const managed = require('./managed-section');

module.exports = {
  parse: parser.parse,
  serialize: parser.serialize,
  listHosts: editor.listHosts,
  addHost: editor.addHost,
  updateHost: editor.updateHost,
  removeHost: editor.removeHost,
  renderManaged: managed.renderManaged,
  formatValue: managed.formatValue,
  MANAGED_BEGIN: managed.BEGIN,
  MANAGED_END: managed.END,
};

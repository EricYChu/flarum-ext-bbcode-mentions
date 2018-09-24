var gulp = require('flarum-gulp');

var bowerDir = 'bower_components';

gulp({
  modules: {
    'flarum/mentions': 'src/**/*.js'
  },
  files: [
    bowerDir + '/Caret.js/dist/jquery.caret.js'
  ]
});

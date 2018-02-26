'use strict';
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const postcss = require('postcss');
const debug = require('debug')('compiler');
const assert = require('assert');

let Compiler = function (options) {
	this.plugins = options.plugins;
	this._sourcePath = options.source;
	this._descPath = options.desc;
	this._suffix = options.suffix || '.pcss';
	this._sourceMap = options.sourceMap || true;
	if (options.multiPath) {
		assert(Array.isArray(options.multiPath), 'multiPath must be a array');
		this._sourcePath = [];
		this._descPath = [];
		this._mpMode = true;
		options.multiPath.forEach(i => {
			this._sourcePath.push(i.source);
			this._descPath.push(i.desc);
		});
	}
	let watcher = chokidar.watch(this._sourcePath);
	watcher.on('all', (event, fpath) => {
		debug(`event is ${event},file path is ${fpath}`);
		if(fs.statSync(fpath).isFile() && !fpath.endsWith(this._suffix)){
			return;
		}
		let desc;
		if(this._mpMode){
			let index ;
			for (let i in this._sourcePath){
				if(fpath.startsWith(this._sourcePath[i])){
					index = i;
					break;
				}
			}
			desc = this._descPath[index]+fpath.substring(this._sourcePath[index].length, fpath.length)
				.replace(this._suffix, '.css');
		}else {
			desc = this._descPath +
				fpath.substring(this._sourcePath.length, fpath.length)
					.replace(this._suffix, '.css');
		}
		debug(desc);
		let a = desc.split(path.sep);
		a.pop();
		fse.ensureDirSync(a.join(path.sep));
		switch (event) {
			case 'add':
				this.compile(fpath, desc);
				break;
			case 'addDir':
				break;
			case 'change':
				this.compile(fpath, desc);
				break;
			case 'unlink':
				fs.unlink(desc, (err, a) => {
					if (err) debug(err);
					debug(a);
				});
				break;
			case
			'unlinkDir':
				fs.rmdir(desc, (err, a) => {
						if (err) debug(err);
						debug(a);
					}
				);
				break;
		}
	});
	watcher.on('error', error => {
		debug(`Watcher error: ${error}`);
	});
	
};
Compiler.prototype.compile = function (source, desc) {
	let processOptions = {from: source, to: desc};
	if (this._sourceMap) processOptions.map = {inline: false};
	fs.readFile(source, (err, css) => {
		postcss(this.plugins)
			.process(css, processOptions)
			.then(result => {
				fs.writeFile(desc, result.css, () => {
					debug('success!');
				});
				if (result.map) fs.writeFile(desc + '.map', result.map, () => {});
			});
	});
};

module.exports = function (options) {
	return new Compiler(options);
};
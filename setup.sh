#!/bin/sh

cwd=$(dirname $0)
cd ${cwd}

cd hexo-img-relocate
npm run tarball

cd ../
npm install

#!/bin/sh

cwd=$(dirname $0)
cd ${cwd}

cd hexo-img-relocate
npm pack
mv hexo-img-relocate-1.0.0.tgz /tmp

cd ../
npm install

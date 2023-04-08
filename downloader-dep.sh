#! /bin/bash

if ! [[ -d "dist/downloader" ]]; then
    git clone -b downloader https://github.com/xeyqe/awesome-cordova-plugins.git dist/downloader
fi

rm -rf node_modules/@awesome-cordova-plugins/downloader/
cp -r dist/downloader/downloader/ node_modules/@awesome-cordova-plugins/

const path = require('path');

module.exports = {
    target: 'web',
    entry: './src/editor/webview/index.ts',
    output: {
        path: path.resolve(__dirname, 'out'),
        filename: 'webview.js'
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js'],
        fallback: {
            "fs": false,
            "path": false
        }
    }
};
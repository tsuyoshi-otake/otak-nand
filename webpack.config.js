import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    target: 'web',
    entry: './src/editor/webview/index.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
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
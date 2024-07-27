const core = require('@actions/core')
const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mime = require('mime-types');

// 配置
const accessKey = core.getInput("accessKey"); // 你的多吉云 AccessKey，在Gitlab>CI/CD里设置
const secretKey = core.getInput("secretKey"); // 你的多吉云 SecretKey，在Gitlab>CI/CD里设置
const s3Bucket = 's-sh-10439-xdog-1258813047'; // 存储空间的 s3Bucket 值，控制台存储空间 SDK 参数选项卡中可以找到
const s3Endpoint = 'https://cos.ap-shanghai.myqcloud.com'; // 存储空间的 s3Endpoint 值，控制台存储空间 SDK 参数选项卡中可以找到
const directoryPath = 'public'; // 要上传的目录路径，替换为实际的值

/**
 * 调用多吉云 API
 *
 * @param {string} apiPath - API 接口路径，例如 '/oss/upload/put.json'
 * @param {object|string} data - 请求体数据，可以是对象或字符串
 * @param {boolean} jsonMode - 是否以 JSON 格式请求数据
 * @param {function} callback - 回调函数
 * @returns {Promise} - 返回一个 Promise
 */
function dogecloudApi(apiPath, data = {}, jsonMode = false, callback = null) {
    const body = jsonMode ? JSON.stringify(data) : querystring.encode(data); // 根据 jsonMode 选择请求体格式
    const sign = crypto.createHmac('sha1', secretKey).update(Buffer.from(apiPath + "\n" + body, 'utf8')).digest('hex'); // 生成签名
    const authorization = 'TOKEN ' + accessKey + ':' + sign; // 设置 Authorization 头部

    return new Promise((resolve, reject) => {
        try {
            axios.request({
                url: 'https://api.dogecloud.com' + apiPath, // 完整 API URL
                method: 'POST', // 使用 POST 方法
                data: body, // 请求体数据
                responseType: 'json', // 响应数据类型
                headers: {
                    'Content-Type': jsonMode ? 'application/json' : 'application/x-www-form-urlencoded',
                    'Authorization': authorization // 设置 Authorization 头部
                }
            })
            .then(response => {
                if (response.data.code !== 200) { // 如果 API 返回错误
                    callback ? callback({ Error: 'API Error: ' + response.data.msg }, null) : reject({ errno: response.data.code, msg: 'API Error: ' + response.data.msg });
                    return;
                }
                callback ? callback(null, response.data.data) : resolve(response.data.data);
            })
            .catch(err => {
                callback ? callback(err, null) : reject(err);
            });
        } catch (error) {
            callback ? callback(error, null) : reject(error);
        }
    });
}

// 获取临时密钥并初始化 S3 实例
dogecloudApi('/auth/tmp_token.json', {
    channel: 'OSS_FULL',
    scopes: ['*']
}, true)
    .then(data => {
        const credentials = data.Credentials;

        const s3 = new S3Client({ // 用服务端返回的信息初始化一个 S3 实例
            region: 'automatic',
            endpoint: s3Endpoint, // 存储空间的 s3Endpoint 值，控制台存储空间 SDK 参数选项卡中可以找到
            credentials: credentials,
            params: {
                Bucket: s3Bucket // 存储空间的 s3Bucket 值，控制台存储空间 SDK 参数选项卡中可以找到
            }
        });

        /**
         * 递归地上传目录及其子目录中的所有文件到 S3
         *
         * @param {string} directoryPath - 目录路径
         * @param {string} basePath - 文件的基路径
         */
        async function uploadFilesFromDirectory(directoryPath, basePath = '') {
            try {
                const files = fs.readdirSync(directoryPath); // 读取目录中的所有文件和子目录

                const uploadPromises = files.map(async file => { // 创建上传文件的 Promise 数组
                    const filePath = path.join(directoryPath, file); // 生成文件的完整路径
                    const fileStat = fs.statSync(filePath); // 获取文件状态

                    if (fileStat.isDirectory()) { // 如果是目录，递归调用 uploadFilesFromDirectory
                        await uploadFilesFromDirectory(filePath, path.join(basePath, file)); // 递归上传子目录中的文件
                    } else { // 如果是文件，上传文件
                        const fileContent = fs.readFileSync(filePath); // 读取文件内容
                        const relativePath = path.join(basePath, file).replace(/\\/g, '/'); // 构建相对路径并替换反斜杠为斜杠
                        const contentType = mime.lookup(filePath) || 'application/octet-stream'; // 获取文件的 Content-Type

                        try {
                            // 上传文件
                            await s3.send(new PutObjectCommand({
                                Bucket: s3Bucket,
                                Key: relativePath,
                                Body: fileContent,
                                ContentType: contentType // 设置 Content-Type
                            }));
                            console.log(`Uploaded ${relativePath} successfully`);
                        } catch (error) {
                            console.error(`Failed to upload ${relativePath}:`, error);
                        }
                    }
                });

                await Promise.all(uploadPromises); // 等待所有文件上传完成

            } catch (error) {
                console.error('Upload failed:', error); // 打印读取目录或上传过程中的错误
            }
        }

        // 调用函数，传递目录路径和储存桶名称
        uploadFilesFromDirectory(directoryPath);
    })
    .catch(err => {
        console.error('Failed to get temporary credentials:', err);
    });

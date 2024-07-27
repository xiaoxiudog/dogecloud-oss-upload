# dogecloud-oss-upload

多吉云储存批量上传命令行工具

# Usage

See [action.yml](action.yml)

示例:

```yml
name: dogecloud-oss-upload

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@master
      - uses: xdogrun/dogecloud-oss-upload@v1
        with:
          accessKey: ${{ secrets.ACCESS_KEY }}
          secretKey: ${{ secrets.SECRET_KEY }}
          s3Bucket: "s-sh-11111-xdog-1111111111"
          s3Endpoint: "https://cos.ap-shanghai.myqcloud.com"
          directoryPath: "public"
```

参数：

- **accessKey**：你的多吉云 AccessKey，`用户中心`>`密钥管理`配置
- **secretKey**：你的多吉云 SecretKey，`用户中心`>`密钥管理`配置
- **s3Bucket**：存储空间的 s3Bucket 值，控制台存储空间 SDK 参数选项卡中可以找到
- **s3Endpoint**：存储空间的 s3Endpoint 值，控制台存储空间 SDK 参数选项卡中可以找到
- **directoryPath**：要上传的目录路径，如`public`

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
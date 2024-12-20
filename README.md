# Files-renamer

一个用于批量重命名媒体文件的命令行工具。根据文件的创建时间,自动重命名为统一格式。

## 功能特点

- 支持批量重命名图片、视频和音频文件
- 根据文件创建时间自动生成新文件名
- 支持单个文件或整个目录的处理
- 文件名格式: `类型_年月日_时分秒_版本.扩展名`
- 自动跳过非媒体文件
- 支持自定义文件名前缀

## 支持的文件格式

- 图片: jpg, jpeg, png, gif, webp, heic, heif, tiff, tif, bmp, raw, arw, cr2, nef
- 视频: mp4, mov, avi, mkv, wmv, flv, 3gp, webm
- 音频: mp3, wav, aac, ogg, m4a, wma

## 安装

```bash
npm install -g files-renamer
```

## 使用

```bash
  rename .              重命名目录下所有支持的媒体文件
  rename . -p STR       自定义前缀
  rename . -e           使用EXIF信息重命名图片
  rename . -m          重命名微信导出的文件
  # 以上操作都会记录重命名记录到renamer_history.txt

  rename . -r                   恢复所有文件到原始文件名
  # 恢复所有文件到原始文件名，会清除renamer_history.txt内对应记录直到为空
```

## 备注
- 文件格式名带了随机版本号，主要是老文件的exif信息不总是可靠的，仅凭创建时间重命名可能会有重复，这样会导致文件丢失
- 微信导出的文件，会自动重命名为mmexport开头，方便识别
- renamer_history.txt 是自动创建的，除非你确认不再用到，否则不要删除，恢复时会用到
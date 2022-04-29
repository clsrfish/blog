import gulp from 'gulp';
import babel from 'gulp-babel';
import cleanCSS from 'gulp-clean-css';
import htmlmin from 'gulp-html-minifier-terser';
import htmlclean from 'gulp-htmlclean';
import imagemin from 'gulp-imagemin';
// gulp-tester (如果使用 gulp-tester,把下面的//去掉)
// const terser from 'gulp-terser');
// babel (如果不是使用bebel,把下面兩行註釋掉)
import uglify from 'gulp-uglify';
import workbox from "workbox-build";


// minify js - babel（ 如果不是使用bebel,把下面註釋掉）
gulp.task('compress', () =>
    gulp.src(['./public/**/*.js', '!./public/**/*.min.js'])
        .pipe(babel({
            presets: ['@babel/preset-env']
        }))
        .pipe(uglify().on('error', function (e) {
            console.log(e)
        }))
        .pipe(gulp.dest('./public'))
)

// minify js - gulp-tester (如果使用 gulp-tester,把下面前面的//去掉)
// gulp.task('compress', () =>
//   gulp.src(['./public/**/*.js', '!./public/**/*.min.js'])
//     .pipe(terser())
//     .pipe(gulp.dest('./public'))
// )


// css
gulp.task('minify-css', () => {
    return gulp.src('./public/**/*.css')
        .pipe(cleanCSS())
        .pipe(gulp.dest('./public'))
})

// 壓縮 public 目錄內 html
gulp.task('minify-html', () => {
    return gulp.src('./public/**/*.html')
        .pipe(htmlclean())
        .pipe(htmlmin({
            removeComments: true, // 清除 HTML 註釋
            collapseWhitespace: true, // 壓縮 HTML
            collapseBooleanAttributes: true, // 省略布爾屬性的值 <input checked="true"/> ==> <input />
            removeEmptyAttributes: true, // 刪除所有空格作屬性值 <input id="" /> ==> <input />
            removeScriptTypeAttributes: true, // 刪除 <script> 的 type="text/javascript"
            removeStyleLinkTypeAttributes: true, // 刪除 <style> 和 <link> 的 type="text/css"
            minifyJS: true, // 壓縮頁面 JS
            minifyCSS: true, // 壓縮頁面 CSS
            minifyURLs: true
        }))
        .pipe(gulp.dest('./public'))
})

// 壓縮 public/uploads 目錄內圖片
gulp.task('minify-images', async () => {
    gulp.src('./public/img/**/*.*')
        .pipe(imagemin())
        .pipe(gulp.dest('./public/img'))
})

gulp.task('gen-sw', () => {
    return workbox.injectManifest({
        swSrc: './sw-template.js',
        swDest: './public/sw.js',
        globDirectory: './public',
        globPatterns: [
            "**/*.{html,css,js,json,woff2,png,jpg,jpeg,webp,gif}"
        ],
        modifyURLPrefix: {
            "": "./"
        }
    });
});

// 執行 gulp 命令時執行的任務
gulp.task('default',
    gulp.series(
        gulp.parallel('compress', 'minify-css', 'minify-html', 'minify-images'),
        'gen-sw'
    )
)
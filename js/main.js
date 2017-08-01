(function () {
    window.onload = function () {
        // 延迟初始化，等到页面完全加载
        setTimeout(init, 1000);

    };
    var currentColor = 'red';
    var highlighter;
    var highlightClassName = 'mark-it-highlight';
    var classPrefix = highlightClassName + '_';
    var idClass = classPrefix + 'id_';
    var colorClass = classPrefix + 'color_';
    var storageKey = 'mark-it';
    var x = 0, y = 0;
    var timeout = 1000 / 60;
    var tipSelector = '#mark-it-popup';
    var currentSelection;
    var allSelections = [];
    var isSaved = false;
    var mouseIsUped = true;
    var hideIconT;
    var $tip;
    var tipTpl = `
<div id="mark-it-popup">
    <div class="mark-it-popup-icon-message-box">
        <div class="mark-it-popup-icon-message-box-title">
        <div data-color="red" class="mark-it-color mark-it-highlight_color_red"></div>
            <div data-color="yellow" class="mark-it-color mark-it-highlight_color_yellow"></div>
            <div data-color="blue" class="mark-it-color mark-it-highlight_color_blue"></div>
            <div data-color="green" class="mark-it-color mark-it-highlight_color_green"></div>
            <div class="mark-it-popup-icon mark-it-popup-icon-delete" style="padding:0;float:right;margin-top:5px"></div>
        </div>
        <div class="mark-it-popup-icon-message-box-input">
            <textarea placeholder="写上你的备注..." resize="false"></textarea>
        </div>
        <div class="mark-it-popup-icon-message-box-tool">
            <div class="mark-it-popup-icon-message-box-tool-save">保存</div>
            <div class="mark-it-popup-icon-message-box-tool-cancel">取消</div>
        </div>
    </div>
</div>
`;

    function init() {
        rangy.init();
        highlighter = rangy.createHighlighter();
        highlighter.addClassApplier(rangy.createClassApplier(highlightClassName, {
            ignoreWhiteSpace: true,
            tagNames: ["span", "a"]
        }));

        // 回显高亮
        getMarks(function (error, marks) {
            if (error || !marks) return;
            var serializedHighlights = marks.map(function (item) {
                return item.serialize;
            });
            serializedHighlights.unshift('type:textContent');
            serializedHighlights = serializedHighlights.join('|');
            highlighter.deserialize(serializedHighlights);
            for (var i = 0; i < marks.length; i++) {
                var mark = marks[i];
                var id = mark.id;
                var color = mark.color;
                // 回显颜色
                $('.' + idClass + id).addClass(colorClass + color);
            }
        });

        // 高亮内容鼠标悬停事件
        var t;
        $(document).on('mouseover', '.' + highlightClassName, function (e) {
            if (!mouseIsUped) return; // 正在选中，未抬起鼠标
            var $this = $(this);
            if (t) clearTimeout(t);
            t = setTimeout(function () {
                clearTimeout(t);
                x = e.clientX + 10;
                y = e.clientY + 10;
                var className = $this.attr('class');
                if (className) {
                    var classNames = className.split(' ');
                    var id;
                    for (var i = 0; i < classNames.length; i++) {
                        var name = classNames[i];
                        if (name.indexOf(idClass) > -1) {
                            id = name.replace(idClass, '');
                            var selection = allSelections.find(function (item) {
                                return item.id == id;
                            });
                            if (!selection) return;
                            isSaved = !!selection;
                            currentSelection = selection;
                            currentColor = selection.color;
                            showTipIcons();
                            if (selection.mark) {
                                showMessageBox();
                            }
                            break;
                        }
                    }
                }
            }, 300);
        });

        // 鼠标移除后，如果没弹出，清除定时
        $(document).on('mouseout', '.' + highlightClassName, function (e) {
            clearTimeout(t)
//                hideIconT = setTimeout(hideIcon, 100);
        });


        // 文档鼠标按下事件
        $('body').mousedown(function () {
            mouseIsUped = false;
        }).mouseup(function (e) { // 文档鼠标抬起事件
            mouseIsUped = true;
            x = e.clientX;
            y = e.clientY;
            // 延时使程序等待页面选区变化的系统响应
            setTimeout(function () {
                var isStandard = !!window.getSelection;
                var selection = isStandard ? window.getSelection() : document.selection.createRange();
                var text = (isStandard ? selection + "" : selection.text).replace(/\n+/g, "|");
                var textLen = text.length;

                if (textLen < 1 || textLen > 2000) {
                    if (!isSaved) {
                        unhighlightSelectionByid(currentSelection && currentSelection.id);
                    }
                    return hideTipIcons();
                }
                isSaved = false;
                currentSelection = highlightSelectedText(currentColor);
                if (!currentSelection) {
                    return;
                }
                showTipIcons(null);
                selection = null;
            }, timeout);
        });
    }

    function showTipIcons() {
        $tip = $(tipSelector);
        if ($tip.length === 0) {
            $('body').append($(tipTpl));
            $tip = $(tipSelector);

            // 提示框鼠标抬起事件
            $tip.on('mouseup', function () {
                // 防止点击一次，再次弹出
                return false;
            });

//                $tip.on('mouseover', function () {
//                    clearTimeout(hideIconT);
//                    showIcon();
//                });

            // 铅笔 移入移除事件
            $('.mark-it-popup-icon-pencil').hover(function () {
                showColorPanel();
            }, function () {
                hideColorPanel();
            });

            // 铅笔 和 颜色块点击事件
            $('.mark-it-popup-icon-pencil, .mark-it-color-panel > div').on('click', function () {
                var color = $(this).data('color');
                if (color) currentColor = color;
                // 改变颜色
                changeColor();
                // 保存标记
                saveMarks(function (error, mark) {
                    if (error) {
                        showNotice('保存失败');
                    } else {
                        // 隐藏提示框
                        hideTipIcons();
                    }
                });
                return false;
            });

            // 消息按钮点击事件
            $('.mark-it-popup-icon-message').click(function () {
                showMessageBox();
                return false;
            });

            // 消息弹框上颜色点击事件
            $('.mark-it-popup-icon-message-box-title > .mark-it-color').click(function () {
                var color = $(this).data('color');
                if (color) currentColor = color;
                changeColor();
            });

            // 弹框输入框点击事件
            $('.mark-it-popup-icon-message-box-input > textarea').click(function () {
                return false;
            });

            // 弹框取消按钮点击事件
            $('.mark-it-popup-icon-message-box-tool-cancel').click(function () {
                hideTipIcons();
            });

            // 弹框保存按钮点击事件
            $('.mark-it-popup-icon-message-box-tool-save').click(function () {
                // 保存标记

                var value = $('.mark-it-popup-icon-message-box-input > textarea').val();
                currentSelection.mark = value;
                saveMarks(function (error, mark) {
                    if (error) {
                        showNotice('保存失败');
                    } else {
                        // 隐藏提示框
                        hideTipIcons();
                    }
                });
            });

            // 删除按钮点击事件
            $('.mark-it-popup-icon-delete').click(function () {
                var id = currentSelection && currentSelection.id;
                deleteMarkByid(id, function (error) {
                    if (error) return;
                    unhighlightSelectionByid(id);
                    hideTipIcons();
                })
            });
        }

        $('.mark-it-popup-icon-message-box-input > textarea').val(currentSelection.mark);

        changeColor();
        var top = document.body.scrollTop + y;
        var left = document.body.scrollLeft + x;
        var tipHeight = 30;
        var tipWidth = 124;
        if (isBottomOut()) {
            top -= tipHeight;
        }

        if (isRightOut()) {
            left -= tipWidth;
        }
        $tip.css({top: top + 'px', left: left + 'px'});
        $tip.fadeIn(150);

        showMessageBox();
    }

    function hideTipIcons() {
        // 提示操作隐藏
        $(tipSelector).fadeOut(150);
        // 弹框隐藏
        hideMessageBox();
        // 弹框输入框清空
        $('.mark-it-popup-icon-message-box-input > textarea').val('');
        // 解决再次划入无法弹起问题
        mouseIsUped = true;
    }

    function isBottomOut(tipHeight) {
        tipHeight = tipHeight || 50;
        var wHeight = $(window).height();
        var sTop = $(document).scrollTop();
        var top = document.body.scrollTop + y;

        return top - sTop + tipHeight > wHeight;
    }

    function isRightOut(tipWidth) {
        tipWidth = tipWidth || 124;
        var wWidth = $(window).width();
        var sLeft = $(document).scrollLeft();
        var left = document.body.scrollLeft + x;
        return left - sLeft + tipWidth > wWidth;
    }

    function showMessageBox() {
        var $box = $('.mark-it-popup-icon-message-box');
        // 覆盖tip bar
        if (isRightOut(340)) {
            $box.css('left', '-190px');
        } else {
            $box.css('left', '10px');
        }
        if (isBottomOut(241)) {
            $box.css('top', '-190px');
        } else {
            $box.css('top', '10px');
        }

        $box.fadeIn(150);

    }

    function hideMessageBox() {
        $('.mark-it-popup-icon-message-box').fadeOut(150);
    }

    function showColorPanel() {
        var $colorPanel = $('.mark-it-color-panel');
        if (isBottomOut()) {
            $colorPanel.css('top', '-42px');
        } else {
            $colorPanel.css('top', '30px');
        }
        $colorPanel.fadeIn(150);
    }

    function hideColorPanel() {
        var $colorPanel = $('.mark-it-color-panel');
        $colorPanel.fadeOut(150);
    }

    function setEleColor(el, color) {
        var $el = $(el);
        var tcn = $el.attr('class') || '';
        var tcns = tcn.split(' ');
        tcns = tcns.filter(function (item) {
            return item.indexOf(colorClass) === -1;
        });
        tcns.push(colorClass + color);
        $el.attr('class', tcns.join(' '));
    }

    function changeColor() {
        var color = currentColor;
        var id = currentSelection && currentSelection.id;

        var pencilIcon = $tip.find('.mark-it-popup-icon-pencil');
        var title = $('.mark-it-popup-icon-message-box-title');
        var selection = $('.' + idClass + id);

        setEleColor(selection, color);
        setEleColor(pencilIcon, color);
        setEleColor(title, color);
    }


    /**
     * 高亮选中文本，添加备注
     * @param color 高亮颜色
     * @param markText 备注信息如果备注信息不存在，只是加高亮
     */
    function highlightSelectedText(color) {
        var selectHtml = rangy.getSelection().toHtml();
        if ($('<div>' + selectHtml + '</div>').find('.' + highlightClassName).length) {
            showNotice('无法嵌套操作!');
            return;
        }
        if ($(rangy.getSelection().anchorNode).parents('.' + highlightClassName).length) {
            showNotice('无法嵌套操作!');
            return;
        }
        var selectText = rangy.getSelection().toString();
        var highlights = highlighter.highlightSelection(highlightClassName);
        if (highlights && highlights.length) {
            var highlight = highlights[0];
            var id = highlight.id;

            $('.' + idClass + id).addClass(colorClass + color);

            var characterRange = highlight.characterRange;
            var parts = [
                characterRange.start,
                characterRange.end,
                highlight.id,
                highlight.classApplier.className,
                highlight.containerElementId
            ];

            var serializeHighlighter = parts.join('$');

            return {
                id: id,
                serialize: serializeHighlighter,
                color: color,
                text: selectText,
                mark: '',
            };
        }
    }

    function showNotice(message, type) {
        type = type || 'error';
        var $notice = $('.mark-it-notice');

        if (!$notice.length) {
            $notice = $('<div class="mark-it-notice"></div>');
            $notice.hide();
            $('body').append($notice);
        }
        if (type === 'error') {
            setEleColor($notice, 'red');
        }
        if (type === 'success') {
            setEleColor($notice, 'green');
        }
        $notice.html(message);
        $notice.slideDown(150);
        setTimeout(function () {
            $notice.slideUp(150);
        }, 3000);
    }

    function unhighlightSelectionByid(id) {
        var className = idClass + id;
        var el = $('.' + className).get(0);
        if (el) {
//                removeIdClass($('.' + _idClass));
            $('.' + className).attr('class', highlightClassName);
            selectText(el);
            highlighter.unhighlightSelection();
        }
    }

    function removeIdClass($el) {
        var className = $el.attr('class');
        if (className) {
            var classNames = className.split(' ');
            classNames.forEach(function (name) {
                if (name.indexOf(classPrefix) > -1) {
                    $el.removeClass(name);
                }
            });
        }
    }

    function selectText(el) {
        if (document.body.createTextRange) {
            var range = document.body.createTextRange();
            range.moveToElementText(el);
            range.select();
        } else if (window.getSelection) {
            var selection = window.getSelection();
            var range = document.createRange();
            range.selectNodeContents(el);
            selection.removeAllRanges();
            selection.addRange(range);
            /*if(selection.setBaseAndExtent){
                         selection.setBaseAndExtent(text, 0, text, 1);
                     }*/
        } else {
            showNotice('选中失败');
        }
    }

    function getMarks(cb) {
        var marks = window.localStorage.getItem(storageKey);
        if (marks) {
            allSelections = JSON.parse(marks);
            cb(null, allSelections)
        } else {
            cb(null, null);
        }
    }

    // 保存 或 更新
    function saveMarks(cb) {
        currentSelection.uir = location.href;
        currentSelection.color = currentColor;

        var exitSelecion = allSelections.find(function (item) {
            return item.id == currentSelection.id;
        });

        if (exitSelecion) {
            exitSelecion.id = currentSelection.id;
            exitSelecion.serialize = currentSelection.serialize;
            exitSelecion.color = currentSelection.color;
            exitSelecion.text = currentSelection.text;
            exitSelecion.mark = currentSelection.mark;
        } else {
            allSelections.push(currentSelection);
        }

        isSaved = true;

        window.localStorage.setItem(storageKey, JSON.stringify(allSelections));
        cb(null)
    }

    function deleteMarkByid(id, cb) {
        allSelections = allSelections.filter(function (item) {
            return item.id != id;
        });

        window.localStorage.setItem(storageKey, JSON.stringify(allSelections));
        cb(null);
    }
})();
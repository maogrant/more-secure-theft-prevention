// 哈基米防盗插件 - 修复版
(function() {
    'use strict';
    
    console.log("🐱 [Hakimi] 插件启动");

    // 等待 SillyTavern 加载
    let attempts = 0;
    const waitForST = setInterval(() => {
        attempts++;
        
        if (typeof SillyTavern !== 'undefined' && typeof jQuery !== 'undefined') {
            clearInterval(waitForST);
            console.log("✅ [Hakimi] SillyTavern 已就绪");
            init();
        } else if (attempts > 100) {
            clearInterval(waitForST);
            console.error("❌ [Hakimi] SillyTavern 加载超时");
        }
    }, 50);

    function init() {
        const MARKER = "HAKIMI_LOCK_V2::";
        let processing = false;

        // 解密函数（与你的加密器完全对应）
        function decrypt(base64Str) {
            try {
                // 对应 btoa(unescape(encodeURIComponent(str)))
                const raw = atob(base64Str);
                const decoded = decodeURIComponent(escape(raw));
                const parsed = JSON.parse(decoded);
                console.log("✅ [Hakimi] 解密成功");
                return parsed;
            } catch (e) {
                console.error("❌ [Hakimi] 解密失败:", e.message);
                return null;
            }
        }

        // 核心解密函数
        async function processCharacter() {
            if (processing) {
                console.log("⏸️ [Hakimi] 正在处理中，跳过");
                return;
            }

            try {
                const context = SillyTavern.getContext();
                
                // 检查 context
                if (!context || !context.characters) {
                    console.log("⚠️ [Hakimi] Context 未就绪");
                    return;
                }

                const charId = context.characterId;
                
                // 检查是否选中角色
                if (charId === undefined || charId === null || charId < 0) {
                    console.log("ℹ️ [Hakimi] 未选中角色");
                    return;
                }

                const char = context.characters[charId];
                
                if (!char) {
                    console.log("⚠️ [Hakimi] 角色对象不存在");
                    return;
                }

                console.log("📋 [Hakimi] 当前角色:", char.name);

                // 检查是否是加密卡
                const notes = char.creator_notes || char.data?.creator_notes || "";
                
                if (!notes.includes(MARKER)) {
                    console.log("ℹ️ [Hakimi] 不是加密卡");
                    return;
                }

                console.log("🔒 [Hakimi] 检测到加密卡！");
                processing = true;

                // 显示提示
                if (typeof toastr !== 'undefined') {
                    toastr.info("正在解密角色卡...", "Hakimi DRM");
                }

                // 提取密文
                const parts = notes.split(MARKER);
                if (parts.length < 2 || !parts[1].trim()) {
                    console.error("❌ [Hakimi] 密文格式错误");
                    if (typeof toastr !== 'undefined') {
                        toastr.error("加密卡格式错误", "Hakimi DRM");
                    }
                    processing = false;
                    return;
                }

                const cipherText = parts[1].trim();
                console.log("🔐 [Hakimi] 密文长度:", cipherText.length);

                // 解密
                const decrypted = decrypt(cipherText);
                if (!decrypted) {
                    if (typeof toastr !== 'undefined') {
                        toastr.error("解密失败", "Hakimi DRM");
                    }
                    processing = false;
                    return;
                }

                // 获取真实数据
                const realData = decrypted.data || decrypted;
                
                if (!realData.name) {
                    console.error("❌ [Hakimi] 解密数据无效");
                    processing = false;
                    return;
                }

                console.log("✅ [Hakimi] 真实角色名:", realData.name);

                // ========== 关键：直接修改 DOM 和内存 ==========
                
                // 1. 修改内存中的角色对象
                const fields = [
                    'name', 'description', 'personality', 'scenario',
                    'first_mes', 'mes_example', 'system_prompt',
                    'post_history_instructions', 'alternate_greetings',
                    'tags', 'creator', 'character_version', 'character_book'
                ];

                fields.forEach(field => {
                    if (realData[field] !== undefined) {
                        char[field] = realData[field];
                        if (char.data) {
                            char.data[field] = realData[field];
                        }
                    }
                });

                // 处理扩展配置
                if (realData.extensions) {
                    char.extensions = Object.assign({}, char.extensions, realData.extensions);
                    if (char.data) {
                        char.data.extensions = Object.assign({}, char.data.extensions, realData.extensions);
                    }
                }

                // 清除加密标记
                char.creator_notes = realData.creator_notes || "Decrypted by Hakimi";
                if (char.data) {
                    char.data.creator_notes = char.creator_notes;
                }

                console.log("✅ [Hakimi] 内存数据已替换");

                // 2. 强制更新界面（多种方法确保生效）
                
                // 方法1：更新角色名显示
                jQuery('#avatar_name_block .ch_name').text(realData.name);
                
                // 方法2：更新描述显示
                jQuery('#character_popup_text_description').val(realData.description);
                jQuery('#character_popup_text_personality').val(realData.personality);
                jQuery('#character_popup_text_scenario').val(realData.scenario);
                
                // 方法3：触发内置的角色更新事件
                if (window.eventSource && window.event_types?.CHARACTER_EDITED) {
                    window.eventSource.emit(window.event_types.CHARACTER_EDITED, { detail: { id: charId } });
                }

                // 方法4：重新加载聊天
                if (context.reloadCurrentChat) {
                    await context.reloadCurrentChat();
                } else if (typeof reloadCurrentChat === 'function') {
                    await reloadCurrentChat();
                }

                console.log("🎉 [Hakimi] 解密完成！");
                
                if (typeof toastr !== 'undefined') {
                    toastr.success(`🔓 ${realData.name} 已解锁`, "Hakimi DRM", {timeOut: 3000});
                } else {
                    alert(`🔓 ${realData.name} 已解锁！`);
                }

            } catch (error) {
                console.error("💥 [Hakimi] 错误:", error);
                if (typeof toastr !== 'undefined') {
                    toastr.error("解密过程出错: " + error.message, "Hakimi DRM");
                }
            } finally {
                // 延迟解锁，防止重复触发
                setTimeout(() => { processing = false; }, 2000);
            }
        }

        // ========== 多重监听策略 ==========
        
        // 策略1：标准事件监听
        if (window.eventSource && window.event_types?.CHARACTER_SELECTED) {
            window.eventSource.on(window.event_types.CHARACTER_SELECTED, () => {
                console.log("📡 [Hakimi] 事件触发：CHARACTER_SELECTED");
                setTimeout(processCharacter, 500);
            });
            console.log("✅ [Hakimi] 事件监听器已注册");
        }

        // 策略2：监听聊天加载完成
        if (window.eventSource && window.event_types?.CHAT_CHANGED) {
            window.eventSource.on(window.event_types.CHAT_CHANGED, () => {
                console.log("📡 [Hakimi] 事件触发：CHAT_CHANGED");
                setTimeout(processCharacter, 500);
            });
        }

        // 策略3：轮询检测（备用方案）
        let lastCharId = null;
        setInterval(() => {
            const ctx = SillyTavern?.getContext?.();
            if (ctx && ctx.characterId !== lastCharId && ctx.characterId >= 0) {
                lastCharId = ctx.characterId;
                console.log("🔄 [Hakimi] 轮询检测到角色切换");
                setTimeout(processCharacter, 500);
            }
        }, 1000);

        // 策略4：页面加载时立即检查一次
        setTimeout(processCharacter, 2000);

        console.log("✅ [Hakimi] 核心功能已启动");
    }
})();// HAKIMI DRM PROTOCOL - GITHUB EDITION
(function() {
    // 依赖检查
    if (typeof jQuery === 'undefined') {
        console.error("[Hakimi] 缺少 jQuery 依赖");
        return;
    }
    
    jQuery(async function() {
        // 检查核心依赖
        if (typeof SillyTavern === 'undefined') {
            console.error("[Hakimi] 缺少 SillyTavern 依赖");
            return;
        }
        if (typeof toastr === 'undefined') {
            console.warn("[Hakimi] toastr 未加载，将使用 console 替代");
        }
        
        console.log("🐱 [Hakimi] 插件已从 GitHub 加载！");

    // 1. 挂载视觉指示器 (证明插件活着)
    const indicator = document.createElement('div');
    indicator.id = 'hakimi-indicator';
    document.body.appendChild(indicator);
    
    // 弹窗提示一次 (确认安装成功)
    if (!localStorage.getItem('hakimi_installed_alert')) {
        alert("✅ 哈基米防盗插件安装成功！\n屏幕顶部的绿条代表卫兵已就位。");
        localStorage.setItem('hakimi_installed_alert', 'true');
    }

    const LOCK_MARKER = "HAKIMI_LOCK_V2::"; 
    let isReloading = false; // 防死循环锁

    // 安全解密 (必须与加密端 btoa(unescape(encodeURIComponent())) 对应)
    function safeDecrypt(base64Str) {
        try {
            if (!base64Str || typeof base64Str !== 'string') return null;
            // 与加密端对应: btoa(unescape(encodeURIComponent(str)))
            // 解密: decodeURIComponent(escape(atob(str)))
            const decoded = decodeURIComponent(escape(window.atob(base64Str)));
            console.log("[Hakimi] 解密成功，数据长度:", decoded.length);
            return JSON.parse(decoded);
        } catch (e) { 
            console.error("[Hakimi] Decrypt Fail:", e); 
            return null; 
        }
    }

    // 验证解密数据结构
    function validateDecryptedData(data) {
        if (!data || typeof data !== 'object') return false;
        const realData = data.data || data;
        // 至少需要 name 字段
        return realData && typeof realData.name === 'string';
    }

    // 安全的 toastr 调用
    function safeToast(type, message, title) {
        if (typeof toastr !== 'undefined' && toastr[type]) {
            toastr[type](message, title);
        } else {
            console.log(`[${title}] ${message}`);
        }
    }

    // 核心拦截重载逻辑
    async function interceptAndReload() {
        if (isReloading) return; // 如果正在重载，跳过

        const context = SillyTavern.getContext();
        const charId = context.characterId;
        
        if (!charId || !context.characters[charId]) return;

        const charObj = context.characters[charId];

        // 检查加密锁
        if (charObj.creator_notes && charObj.creator_notes.includes(LOCK_MARKER)) {
            console.log("🔒 [Hakimi] 发现加密卡，启动拦截...");
            
            const parts = charObj.creator_notes.split(LOCK_MARKER);
            if (parts.length < 2 || !parts[1]) {
                console.warn("[Hakimi] 加密数据格式无效");
                return;
            }
            const raw = parts[1].trim();
            const decrypted = safeDecrypt(raw);

            if (decrypted && validateDecryptedData(decrypted)) {
                const realData = decrypted.data || decrypted;
                console.log("[Hakimi] 解密数据结构:", Object.keys(realData));

                // 2. 修改全局数据库 (内存层)
                // 这一步把空壳替换成真身 - 复制所有关键字段
                Object.assign(charObj, {
                    name: realData.name,
                    description: realData.description,
                    personality: realData.personality,
                    first_mes: realData.first_mes,
                    mes_example: realData.mes_example,
                    scenario: realData.scenario,
                    system_prompt: realData.system_prompt,
                    post_history_instructions: realData.post_history_instructions,
                    tags: realData.tags,
                    // 保留原始扩展并合并（包含正则表达式等）
                    extensions: { ...charObj.extensions, ...(realData.extensions || {}) },
                    // 关键：挂载世界书
                    character_book: realData.character_book || realData.world_info,
                    // 备选开场白
                    alternate_greetings: realData.alternate_greetings || [],
                    // 元数据
                    creator: realData.creator,
                    character_version: realData.character_version,
                    // 抹除锁标记 (保留原始注释)
                    creator_notes: realData.creator_notes || "Decrypted by Hakimi"
                });
                
                // 如果有 data 层，也同步更新
                if (charObj.data) {
                    Object.assign(charObj.data, {
                        name: realData.name,
                        description: realData.description,
                        personality: realData.personality,
                        first_mes: realData.first_mes,
                        mes_example: realData.mes_example,
                        scenario: realData.scenario,
                        system_prompt: realData.system_prompt,
                        post_history_instructions: realData.post_history_instructions,
                        tags: realData.tags,
                        extensions: { ...charObj.data.extensions, ...(realData.extensions || {}) },
                        character_book: realData.character_book || realData.world_info,
                        alternate_greetings: realData.alternate_greetings || [],
                        creator: realData.creator,
                        character_version: realData.character_version,
                        creator_notes: realData.creator_notes || "Decrypted by Hakimi"
                    });
                }
                
                console.log("[Hakimi] 内存数据已替换，角色名:", realData.name);

                // 3. 强制重载 (让酒馆重新读取内存)
                isReloading = true;
                try {
                    safeToast('info', "正在解码...", "Hakimi DRM");
                    await context.loadCharacter(charId);
                    safeToast('success', `🔓 ${realData.name} 解锁完成`, "Hakimi DRM");
                } catch (e) {
                    console.error("[Hakimi] 重载失败", e);
                    safeToast('error', "角色重载失败", "Hakimi DRM");
                } finally {
                    // 等待 DOM 更新完成后再解锁
                    requestAnimationFrame(() => {
                        setTimeout(() => { isReloading = false; }, 500);
                    });
                }
            }
        }
    }

    // 注册监听器
    if (window.eventSource && window.event_types?.CHARACTER_SELECTED) {
        window.eventSource.on(window.event_types.CHARACTER_SELECTED, () => {
            setTimeout(interceptAndReload, 50);
        });
        console.log("[Hakimi] 事件监听器已注册");
    } else {
        console.warn("[Hakimi] eventSource 或 event_types 不可用，监听器未注册");
    }
    });
})();
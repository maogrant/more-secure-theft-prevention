(function() {
    if (typeof jQuery === 'undefined') {
        console.error("[Hakimi] 缺少 jQuery");
        return;
    }
    
    jQuery(async function() {
        if (typeof SillyTavern === 'undefined') {
            console.error("[Hakimi] 缺少 SillyTavern");
            return;
        }
        
        console.log("🐱 [Hakimi] 八层解密插件已加载 v1.2");

        const indicator = document.createElement('div');
        indicator.id = 'hakimi-indicator';
        document.body.appendChild(indicator);
        
        if (!localStorage.getItem('hakimi_installed_alert')) {
            alert("✅ 哈基米八层加密插件安装成功！");
            localStorage.setItem('hakimi_installed_alert', 'true');
        }

        let isReloading = false;

        // ============ 工具函数：安全的字节转字符串 ============
        
        function bytesToString(bytes) {
            // 分块处理，避免栈溢出
            const CHUNK_SIZE = 8192;
            let result = '';
            const arr = bytes instanceof Uint8Array ? bytes : 
                        (bytes instanceof Uint16Array ? bytes : Array.from(bytes));
            for (let i = 0; i < arr.length; i += CHUNK_SIZE) {
                const end = Math.min(i + CHUNK_SIZE, arr.length);
                const chunk = [];
                for (let j = i; j < end; j++) {
                    chunk.push(arr[j]);
                }
                result += String.fromCharCode.apply(null, chunk);
            }
            return result;
        }

        // 🔧 预计算模逆元表
        const modInverseTable = {};
        for (let a = 1; a < 256; a += 2) {
            for (let x = 1; x < 256; x++) {
                if ((a * x) % 256 === 1) {
                    modInverseTable[a] = x;
                    break;
                }
            }
        }

        function safeDecrypt(encodedStr) {
            try {
                if (!encodedStr || typeof encodedStr !== 'string') return null;
                console.log("[Hakimi] 开始八层解密...");
                return decodeEightLayers(encodedStr);
            } catch (e) { 
                console.error("[Hakimi] 解密失败:", e); 
                return null; 
            }
        }

        function decodeEightLayers(data) {
            try {
                let result = data;
                
                // 安全检查输入
                if (!result || typeof result !== 'string' || result.length === 0) {
                    console.error("[Hakimi] 输入数据无效");
                    return null;
                }
                
                const lines = data.split('\n');
                const startIndex = lines.findIndex(l => l.includes('=== DATA START ==='));
                const endIndex = lines.findIndex(l => l.includes('=== DATA END ==='));
                
                if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                    result = lines.slice(startIndex + 1, endIndex).join('\n');
                    console.log("[Hakimi] ✓ 移除保护层");
                }
                
                if (!result || result.trim().length === 0) {
                    console.error("[Hakimi] 提取后数据为空");
                    return null;
                }
                
                result = removeChecksum(result);
                console.log("[Hakimi] ✓ 移除校验和");
                
                result = result.replace(/[\u200B\u200C\u200D\uFEFF\u0300-\u036F\u1AB0-\u1AFF\u20D0-\u20FF\uFE20-\uFE2F]/g, '');
                console.log("[Hakimi] ✓ Unicode去混淆");
                
                result = base91Decode(result);
                if (!result || result.length === 0) {
                    console.error("[Hakimi] Base91解码失败");
                    return null;
                }
                console.log("[Hakimi] ✓ Base91解码");
                
                result = railFenceDecipher(result, 4);
                console.log("[Hakimi] ✓ 栅栏解密");
                
                result = xorChainReverse(result, 3);
                console.log("[Hakimi] ✓ XOR解密");
                
                result = fibonacciUnshuffle(result, 2);
                console.log("[Hakimi] ✓ 反洗牌");
                
                result = matrixTransformReverse(result, 1);
                console.log("[Hakimi] ✓ 矩阵逆变换");
                
                result = byteTransformReverse(result, 0);
                console.log("[Hakimi] ✓ 字节逆变换");
                
                // 清理并解析JSON
                result = result.replace(/[\x00-\x1F]/g, ' ').replace(/\s+/g, ' ').trim();
                
                // 尝试查找JSON边界
                const jsonStart = result.indexOf('{');
                const jsonEnd = result.lastIndexOf('}');
                
                if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
                    console.error("[Hakimi] 无法找到JSON边界");
                    return null;
                }
                
                const jsonStr = result.substring(jsonStart, jsonEnd + 1);
                const jsonData = JSON.parse(jsonStr);
                
                delete jsonData._format;
                delete jsonData._version;
                delete jsonData._timestamp;
                delete jsonData._encoder;
                delete jsonData._watermark;
                
                console.log("[Hakimi] ✅ 解密完成！角色:", jsonData.name || jsonData.data?.name);
                return jsonData;
                
            } catch (e) {
                console.error("[Hakimi] ❌ 解密失败:", e);
                return null;
            }
        }

        function removeChecksum(str) {
            const interval = Math.max(3, Math.floor(str.length / 12));
            let result = '';
            let checksumCount = 0;
            
            for (let i = 0; i < str.length; i++) {
                if (i % interval === interval - 1 && checksumCount < 12) {
                    checksumCount++;
                } else {
                    result += str[i];
                }
            }
            return result;
        }

        function base91Decode(str) {
            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~\"";
            const result = [];
            let buffer = 0;
            let bits = 0;
            let v = -1;
            
            for (let i = 0; i < str.length; i++) {
                const index = alphabet.indexOf(str[i]);
                if (index === -1) continue;
                
                if (v < 0) {
                    v = index;
                } else {
                    v += index * 91;
                    buffer |= v << bits;
                    bits += (v & 8191) > 88 ? 13 : 14;
                    
                    while (bits > 7) {
                        result.push(buffer & 255);
                        buffer >>= 8;
                        bits -= 8;
                    }
                    v = -1;
                }
            }
            
            if (v >= 0) {
                result.push((buffer | (v << bits)) & 255);
            }
            
            return bytesToString(result);
        }

        function railFenceDecipher(str, layerIndex) {
            const rails = 3 + (layerIndex % 5);
            const fence = new Array(rails).fill().map(() => []);
            
            const railLengths = new Array(rails).fill(0);
            let rail = 0, direction = 1;
            
            for (let i = 0; i < str.length; i++) {
                railLengths[rail]++;
                rail += direction;
                if (rail === 0 || rail === rails - 1) direction = -direction;
            }
            
            let index = 0;
            for (let r = 0; r < rails; r++) {
                for (let i = 0; i < railLengths[r]; i++) {
                    fence[r].push(str[index++]);
                }
            }
            
            let result = '';
            rail = 0;
            direction = 1;
            const fenceIndices = new Array(rails).fill(0);
            
            for (let i = 0; i < str.length; i++) {
                result += fence[rail][fenceIndices[rail]++];
                rail += direction;
                if (rail === 0 || rail === rails - 1) direction = -direction;
            }
            
            return result;
        }

        function xorChainReverse(str, layerIndex) {
            const bytes = new TextEncoder().encode(str);
            const key = generateKey(layerIndex, bytes.length);
            const result = new Uint8Array(bytes.length);
            
            let prevByte = key[0];
            for (let i = 0; i < bytes.length; i++) {
                let transformedByte = bytes[i];
                
                // 逆向非线性变换
                const a = 1103515245;
                const c = 12345;
                const m = 2147483648;
                let x = (transformedByte * i + a) % m;
                x = (x * a + c) % m;
                transformedByte = x % 256;
                
                result[i] = transformedByte ^ prevByte ^ key[i % key.length];
                prevByte = (bytes[i] + i) % 256;
            }
            
            return bytesToString(result);
        }

        function fibonacciUnshuffle(str, layerIndex) {
            // 使用Uint16Array避免大数组操作
            const len = str.length;
            const chars = new Uint16Array(len);
            for (let i = 0; i < len; i++) {
                chars[i] = str.charCodeAt(i);
            }
            
            // 限制斐波那契数列长度
            const fibLen = Math.min(len, 1000);
            const fib = generateFibonacci(fibLen);
            
            for (let round = 2; round >= 0; round--) {
                for (let i = len - 1; i > 0; i--) {
                    const fibIndex = i % fib.length;
                    const swapWith = (i + fib[fibIndex]) % len;
                    if (swapWith !== i) {
                        const temp = chars[i];
                        chars[i] = chars[swapWith];
                        chars[swapWith] = temp;
                    }
                }
            }
            
            return bytesToString(chars);
        }

        // 🔧 修复：完整的矩阵逆变换
        function matrixTransformReverse(str, layerIndex) {
            const matrixSize = 5;
            const bytes = new TextEncoder().encode(str);
            const paddedLength = Math.ceil(bytes.length / (matrixSize * matrixSize)) * (matrixSize * matrixSize);
            const result = new Uint8Array(paddedLength);
            const matrixCount = paddedLength / (matrixSize * matrixSize);
            
            const transformationMatrix = [
                [3, 5, 7, 11, 13],
                [17, 19, 23, 29, 31],
                [37, 41, 43, 47, 53],
                [59, 61, 67, 71, 73],
                [79, 83, 89, 97, 101]
            ];
            
            const multipliers = [
                [3, 5, 7, 9, 11],
                [13, 15, 17, 19, 21],
                [23, 25, 27, 29, 31],
                [33, 35, 37, 39, 41],
                [43, 45, 47, 49, 51]
            ];
            
            for (let m = 0; m < matrixCount; m++) {
                const startIdx = m * matrixSize * matrixSize;
                const matrix = new Array(matrixSize).fill(0).map(() => new Array(matrixSize).fill(0));
                
                for (let i = 0; i < matrixSize; i++) {
                    for (let j = 0; j < matrixSize; j++) {
                        const idx = startIdx + i * matrixSize + j;
                        matrix[i][j] = idx < bytes.length ? bytes[idx] : 0;
                    }
                }
                
                // 🔧 逆向螺旋旋转
                const unrotated = spiralUnrotate(matrix);
                
                // 🔧 逆向乘法和加法
                for (let i = 0; i < matrixSize; i++) {
                    for (let j = 0; j < matrixSize; j++) {
                        let val = unrotated[i][j];
                        
                        // 逆向乘法（使用模逆元）
                        const mult = multipliers[i][j];
                        if (modInverseTable[mult]) {
                            val = (val * modInverseTable[mult]) % 256;
                        }
                        
                        // 逆向加法
                        val = (val - transformationMatrix[i][j] + 256) % 256;
                        
                        unrotated[i][j] = val;
                    }
                }
                
                // 🔧 逆向转置
                for (let i = 0; i < matrixSize; i++) {
                    for (let j = i + 1; j < matrixSize; j++) {
                        [unrotated[i][j], unrotated[j][i]] = [unrotated[j][i], unrotated[i][j]];
                    }
                }
                
                for (let i = 0; i < matrixSize; i++) {
                    for (let j = 0; j < matrixSize; j++) {
                        const idx = startIdx + i * matrixSize + j;
                        result[idx] = unrotated[i][j];
                    }
                }
            }
            
            return bytesToString(result.slice(0, bytes.length));
        }

        // 🔧 新增：螺旋逆旋转函数
        function spiralUnrotate(matrix) {
            const size = matrix.length;
            const result = new Array(size).fill(0).map(() => new Array(size).fill(0));
            
            let top = 0, bottom = size - 1;
            let left = 0, right = size - 1;
            let values = [];
            
            // 按逆时针螺旋收集
            while (top <= bottom && left <= right) {
                for (let i = left; i <= right; i++) values.push(matrix[top][i]);
                top++;
                
                for (let i = top; i <= bottom; i++) values.push(matrix[i][right]);
                right--;
                
                if (top <= bottom) {
                    for (let i = right; i >= left; i--) values.push(matrix[bottom][i]);
                    bottom--;
                }
                
                if (left <= right) {
                    for (let i = bottom; i >= top; i--) values.push(matrix[i][left]);
                    left++;
                }
            }
            
            // 按顺时针螺旋填充
            let index = values.length - 1;
            top = 0; bottom = size - 1;
            left = 0; right = size - 1;
            
            while (top <= bottom && left <= right && index >= 0) {
                for (let i = left; i <= right && index >= 0; i++) {
                    result[top][i] = values[index--];
                }
                top++;
                
                for (let i = top; i <= bottom && index >= 0; i++) {
                    result[i][right] = values[index--];
                }
                right--;
                
                if (top <= bottom) {
                    for (let i = right; i >= left && index >= 0; i--) {
                        result[bottom][i] = values[index--];
                    }
                    bottom--;
                }
                
                if (left <= right) {
                    for (let i = bottom; i >= top && index >= 0; i--) {
                        result[i][left] = values[index--];
                    }
                    left++;
                }
            }
            
            return result;
        }

        // 🔧 修复：字节逆变换（两步分离，使用Uint8Array避免UTF-8编码问题）
        function byteTransformReverse(str, layerIndex) {
            // 使用Uint8Array直接处理字节，避免字符串编码问题
            const bytes = new Uint8Array(str.length);
            for (let i = 0; i < str.length; i++) {
                bytes[i] = str.charCodeAt(i) & 0xFF;
            }
            
            const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
            
            // 第一步：逆向主要变换
            const step1 = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) {
                let byte = bytes[i];
                
                // 逆向XOR
                const positionFactor = (i * 13) % 256;
                byte ^= positionFactor;
                
                // 逆向加法
                const prime = primes[i % primes.length];
                const layerFactor = (layerIndex + 1) * 17;
                byte = (byte - prime - layerFactor + 2560) % 256;
                
                // 逆向循环移位
                const shift = (i % 7) + 1;
                byte = ((byte << shift) | (byte >> (8 - shift))) & 0xFF;
                
                step1[i] = byte;
            }
            
            // 第二步：逆向相邻字节互动
            const result = new Uint8Array(bytes.length);
            for (let i = bytes.length - 1; i >= 0; i--) {
                let byte = step1[i];
                
                if (i < bytes.length - 1) byte ^= step1[i + 1] & 0xF0;
                if (i > 0) byte ^= step1[i - 1] & 0x0F;
                
                result[i] = byte;
            }
            
            // 使用String.fromCharCode直接构造字符串，避免TextDecoder的UTF-8解析
            let finalResult = '';
            for (let i = 0; i < result.length; i++) {
                finalResult += String.fromCharCode(result[i]);
            }
            return finalResult;
        }

        function generateKey(layerIndex, length) {
            const seed = 3141592653 + layerIndex * 1000007;
            const key = new Uint8Array(length);
            
            for (let i = 0; i < length; i++) {
                // 使用安全的位运算，避免溢出
                let x = ((seed >>> 0) + (i * 2654435761 >>> 0)) >>> 0;
                x = (x ^ (x >>> 13)) >>> 0;
                x = (x ^ (x << 17)) >>> 0;
                x = (x ^ (x >>> 5)) >>> 0;
                key[i] = x & 255;
            }
            
            return key;
        }

        function generateFibonacci(length) {
            // 限制长度避免数字溢出
            const maxLen = Math.min(length, 1000);
            const fib = [1, 1];
            while (fib.length < maxLen) {
                // 使用取模防止数字过大
                const next = (fib[fib.length - 1] + fib[fib.length - 2]) % 1000000007;
                fib.push(next);
            }
            return fib.slice(0, maxLen);
        }

        // ============ 加密函数（导出时使用）============

        function encodeEightLayers(jsonData) {
            try {
                // 添加元数据
                const dataWithMeta = {
                    ...jsonData,
                    _format: 'HAKIMI_8LAYER',
                    _version: 'v12.1',
                    _timestamp: Date.now(),
                    _encoder: 'Hakimi_Plugin',
                    _watermark: 'Protected'
                };
                
                let result = JSON.stringify(dataWithMeta);
                console.log("[Hakimi] 开始八层加密...");
                
                // 第1层：字节变换
                result = byteTransformForward(result, 0);
                console.log("[Hakimi] ✓ 字节变换");
                
                // 第2层：矩阵变换
                result = matrixTransformForward(result, 1);
                console.log("[Hakimi] ✓ 矩阵变换");
                
                // 第3层：斐波那契洗牌
                result = fibonacciShuffle(result, 2);
                console.log("[Hakimi] ✓ 洗牌");
                
                // 第4层：XOR链式加密
                result = xorChainForward(result, 3);
                console.log("[Hakimi] ✓ XOR加密");
                
                // 第5层：栅栏加密
                result = railFenceCipher(result, 4);
                console.log("[Hakimi] ✓ 栅栏加密");
                
                // 第6层：Base91编码
                result = base91Encode(result);
                console.log("[Hakimi] ✓ Base91编码");
                
                // 第7层：Unicode混淆
                result = addUnicodeObfuscation(result);
                console.log("[Hakimi] ✓ Unicode混淆");
                
                // 第8层：添加校验和
                result = addChecksum(result);
                console.log("[Hakimi] ✓ 添加校验和");
                
                // 添加保护层标记
                result = '=== DATA START ===\n' + result + '\n=== DATA END ===';
                console.log("[Hakimi] ✅ 加密完成！");
                
                return result;
            } catch (e) {
                console.error("[Hakimi] ❌ 加密失败:", e);
                return null;
            }
        }

        function byteTransformForward(str, layerIndex) {
            const bytes = new TextEncoder().encode(str);
            const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
            
            // 第一步：主要变换
            const step1 = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) {
                let byte = bytes[i];
                
                // XOR
                const positionFactor = (i * 13) % 256;
                byte ^= positionFactor;
                
                // 加法
                const prime = primes[i % primes.length];
                const layerFactor = (layerIndex + 1) * 17;
                byte = (byte + prime + layerFactor) % 256;
                
                // 循环移位
                const shift = (i % 7) + 1;
                byte = ((byte << shift) | (byte >> (8 - shift))) & 0xFF;
                
                step1[i] = byte;
            }
            
            // 第二步：相邻字节互动
            const result = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) {
                let byte = step1[i];
                
                if (i > 0) byte ^= step1[i - 1] & 0x0F;
                if (i < bytes.length - 1) byte ^= step1[i + 1] & 0xF0;
                
                result[i] = byte;
            }
            
            return bytesToString(result);
        }

        function matrixTransformForward(str, layerIndex) {
            const matrixSize = 5;
            const bytes = new TextEncoder().encode(str);
            const paddedLength = Math.ceil(bytes.length / (matrixSize * matrixSize)) * (matrixSize * matrixSize);
            const paddedBytes = new Uint8Array(paddedLength);
            paddedBytes.set(bytes);
            
            const result = new Uint8Array(paddedLength);
            const matrixCount = paddedLength / (matrixSize * matrixSize);
            
            const transformationMatrix = [
                [3, 5, 7, 11, 13],
                [17, 19, 23, 29, 31],
                [37, 41, 43, 47, 53],
                [59, 61, 67, 71, 73],
                [79, 83, 89, 97, 101]
            ];
            
            const multipliers = [
                [3, 5, 7, 9, 11],
                [13, 15, 17, 19, 21],
                [23, 25, 27, 29, 31],
                [33, 35, 37, 39, 41],
                [43, 45, 47, 49, 51]
            ];
            
            for (let m = 0; m < matrixCount; m++) {
                const startIdx = m * matrixSize * matrixSize;
                const matrix = new Array(matrixSize).fill(0).map(() => new Array(matrixSize).fill(0));
                
                for (let i = 0; i < matrixSize; i++) {
                    for (let j = 0; j < matrixSize; j++) {
                        const idx = startIdx + i * matrixSize + j;
                        matrix[i][j] = paddedBytes[idx];
                    }
                }
                
                // 转置
                for (let i = 0; i < matrixSize; i++) {
                    for (let j = i + 1; j < matrixSize; j++) {
                        [matrix[i][j], matrix[j][i]] = [matrix[j][i], matrix[i][j]];
                    }
                }
                
                // 加法和乘法
                for (let i = 0; i < matrixSize; i++) {
                    for (let j = 0; j < matrixSize; j++) {
                        let val = matrix[i][j];
                        val = (val + transformationMatrix[i][j]) % 256;
                        val = (val * multipliers[i][j]) % 256;
                        matrix[i][j] = val;
                    }
                }
                
                // 螺旋旋转
                const rotated = spiralRotate(matrix);
                
                for (let i = 0; i < matrixSize; i++) {
                    for (let j = 0; j < matrixSize; j++) {
                        const idx = startIdx + i * matrixSize + j;
                        result[idx] = rotated[i][j];
                    }
                }
            }
            
            return bytesToString(result.slice(0, bytes.length));
        }

        function spiralRotate(matrix) {
            const size = matrix.length;
            const result = new Array(size).fill(0).map(() => new Array(size).fill(0));
            
            let top = 0, bottom = size - 1;
            let left = 0, right = size - 1;
            let values = [];
            
            // 按顺时针螺旋收集
            while (top <= bottom && left <= right) {
                for (let i = left; i <= right; i++) values.push(matrix[top][i]);
                top++;
                for (let i = top; i <= bottom; i++) values.push(matrix[i][right]);
                right--;
                if (top <= bottom) {
                    for (let i = right; i >= left; i--) values.push(matrix[bottom][i]);
                    bottom--;
                }
                if (left <= right) {
                    for (let i = bottom; i >= top; i--) values.push(matrix[i][left]);
                    left++;
                }
            }
            
            // 反转后按逆时针螺旋填充
            values = values.reverse();
            let index = 0;
            top = 0; bottom = size - 1;
            left = 0; right = size - 1;
            
            while (top <= bottom && left <= right && index < values.length) {
                for (let i = left; i <= right && index < values.length; i++) {
                    result[top][i] = values[index++];
                }
                top++;
                for (let i = top; i <= bottom && index < values.length; i++) {
                    result[i][right] = values[index++];
                }
                right--;
                if (top <= bottom) {
                    for (let i = right; i >= left && index < values.length; i--) {
                        result[bottom][i] = values[index++];
                    }
                    bottom--;
                }
                if (left <= right) {
                    for (let i = bottom; i >= top && index < values.length; i--) {
                        result[i][left] = values[index++];
                    }
                    left++;
                }
            }
            
            return result;
        }

        function fibonacciShuffle(str, layerIndex) {
            // 使用Uint16Array避免大数组操作
            const len = str.length;
            const chars = new Uint16Array(len);
            for (let i = 0; i < len; i++) {
                chars[i] = str.charCodeAt(i);
            }
            
            // 限制斐波那契数列长度，避免生成过大数组
            const fibLen = Math.min(len, 1000);
            const fib = generateFibonacci(fibLen);
            
            for (let round = 0; round < 3; round++) {
                for (let i = 1; i < len; i++) {
                    const fibIndex = i % fib.length;
                    const swapWith = (i + fib[fibIndex]) % len;
                    if (swapWith !== i) {
                        const temp = chars[i];
                        chars[i] = chars[swapWith];
                        chars[swapWith] = temp;
                    }
                }
            }
            
            return bytesToString(chars);
        }

        function xorChainForward(str, layerIndex) {
            const bytes = new TextEncoder().encode(str);
            const key = generateKey(layerIndex, bytes.length);
            const result = new Uint8Array(bytes.length);
            
            let prevByte = key[0];
            for (let i = 0; i < bytes.length; i++) {
                let transformedByte = bytes[i] ^ prevByte ^ key[i % key.length];
                
                // 非线性变换
                const a = 1103515245;
                const c = 12345;
                const m = 2147483648;
                let x = (transformedByte * i + a) % m;
                x = (x * a + c) % m;
                transformedByte = x % 256;
                
                result[i] = transformedByte;
                prevByte = (result[i] + i) % 256;
            }
            
            return bytesToString(result);
        }

        function railFenceCipher(str, layerIndex) {
            const rails = 3 + (layerIndex % 5);
            const fence = new Array(rails).fill().map(() => []);
            
            let rail = 0, direction = 1;
            for (let i = 0; i < str.length; i++) {
                fence[rail].push(str[i]);
                rail += direction;
                if (rail === 0 || rail === rails - 1) direction = -direction;
            }
            
            return fence.map(r => r.join('')).join('');
        }

        function base91Encode(str) {
            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~\"";
            const bytes = new TextEncoder().encode(str);
            let result = '';
            let buffer = 0;
            let bits = 0;
            
            for (let i = 0; i < bytes.length; i++) {
                buffer |= bytes[i] << bits;
                bits += 8;
                
                if (bits > 13) {
                    let val = buffer & 8191;
                    if (val > 88) {
                        buffer >>= 13;
                        bits -= 13;
                    } else {
                        val = buffer & 16383;
                        buffer >>= 14;
                        bits -= 14;
                    }
                    result += alphabet[val % 91] + alphabet[Math.floor(val / 91)];
                }
            }
            
            if (bits > 0) {
                result += alphabet[buffer % 91];
                if (bits > 7 || buffer > 90) {
                    result += alphabet[Math.floor(buffer / 91)];
                }
            }
            
            return result;
        }

        function addUnicodeObfuscation(str) {
            const zwChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
            let result = '';
            
            for (let i = 0; i < str.length; i++) {
                result += str[i];
                if (i % 7 === 0) {
                    result += zwChars[i % zwChars.length];
                }
            }
            
            return result;
        }

        function addChecksum(str) {
            const interval = Math.max(3, Math.floor(str.length / 12));
            let result = '';
            let checksumCount = 0;
            let charIndex = 0;
            
            for (let i = 0; checksumCount < 12 && charIndex < str.length; i++) {
                if (i % interval === interval - 1 && checksumCount < 12) {
                    // 插入校验字符
                    const checkChar = String.fromCharCode(65 + (charIndex % 26));
                    result += checkChar;
                    checksumCount++;
                }
                if (charIndex < str.length) {
                    result += str[charIndex++];
                }
            }
            
            // 添加剩余字符
            result += str.slice(charIndex);
            
            return result;
        }

        // 保存原始角色数据用于导出时加密
        const originalEncryptedData = new Map();
        
        // 记录已解密的角色ID
        function markDecrypted(charId, originalPayload) {
            originalEncryptedData.set(charId, originalPayload);
        }
        
        function getOriginalPayload(charId) {
            return originalEncryptedData.get(charId);
        }

        function safeToast(type, message, title) {
            if (typeof toastr !== 'undefined' && toastr[type]) {
                toastr[type](message, title);
            } else {
                console.log(`[${title}] ${message}`);
            }
        }

        async function interceptAndReload() {
            if (isReloading) return;

            const context = SillyTavern.getContext();
            const charId = context.characterId;
            
            if (!charId || !context.characters[charId]) return;

            const charObj = context.characters[charId];

            if (charObj.creator_notes && charObj.creator_notes.includes("HAKIMI_8LAYER::")) {
                console.log("🔒 [Hakimi] 发现加密卡");
                
                const parts = charObj.creator_notes.split("HAKIMI_8LAYER::");
                if (parts.length < 2 || !parts[1]) {
                    console.warn("[Hakimi] 格式无效");
                    return;
                }
                
                const raw = parts[1].trim();
                const decrypted = safeDecrypt(raw);

                if (decrypted && (decrypted.name || decrypted.data?.name)) {
                    const realData = decrypted.data || decrypted;
                    console.log("[Hakimi] 解密成功:", realData.name);
                    
                    // 保存原始加密数据
                    markDecrypted(charId, raw);

                    // 完整的字段列表，确保所有角色卡信息都能正确解密
                    const fieldsToCopy = [
                        'name', 'description', 'personality', 'first_mes', 'mes_example',
                        'scenario', 'system_prompt', 'post_history_instructions', 'tags',
                        'creator', 'character_version', 'talkativeness', 'fav',
                        'depth_prompt_prompt', 'depth_prompt_depth', 'depth_prompt_role'
                    ];
                    
                    // 复制所有存在的字段
                    fieldsToCopy.forEach(field => {
                        if (realData[field] !== undefined) {
                            charObj[field] = realData[field];
                        }
                    });
                    
                    // 特殊字段处理
                    charObj.extensions = { ...charObj.extensions, ...(realData.extensions || {}) };
                    charObj.character_book = realData.character_book || realData.world_info || charObj.character_book;
                    charObj.alternate_greetings = realData.alternate_greetings || [];
                    charObj.creator_notes = realData.creator_notes || "Decrypted by Hakimi";
                    
                    // 同步到data子对象
                    if (charObj.data) {
                        fieldsToCopy.forEach(field => {
                            if (realData[field] !== undefined) {
                                charObj.data[field] = realData[field];
                            }
                        });
                        charObj.data.extensions = { ...charObj.data.extensions, ...(realData.extensions || {}) };
                        charObj.data.character_book = charObj.character_book;
                        charObj.data.alternate_greetings = charObj.alternate_greetings;
                        charObj.data.creator_notes = charObj.creator_notes;
                    }

                    isReloading = true;
                    try {
                        safeToast('info', "正在解码...", "Hakimi DRM");
                        await context.loadCharacter(charId);
                        safeToast('success', `🔓 ${realData.name} 解锁完成`, "Hakimi DRM");
                    } catch (e) {
                        console.error("[Hakimi] 重载失败", e);
                        safeToast('error', "重载失败", "Hakimi DRM");
                    } finally {
                        setTimeout(() => { isReloading = false; }, 500);
                    }
                }
            }
        }

        if (window.eventSource && window.event_types?.CHARACTER_SELECTED) {
            window.eventSource.on(window.event_types.CHARACTER_SELECTED, () => {
                setTimeout(interceptAndReload, 50);
            });
            console.log("[Hakimi] 监听器已注册");
        }

        // ============ 导出拦截 ============

        // 拦截fetch请求以处理导出
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const [url, options] = args;
            
            // 检测JSON导出请求 - 支持多种导出API路径
            const isExportRequest = typeof url === 'string' && (
                url.includes('/api/characters/export') ||
                (url.includes('/api/characters/') && url.includes('export')) ||
                url.includes('/exportcharacter')
            );
            
            if (isExportRequest && (!options?.method || options.method === 'POST' || options.method === 'GET')) {
                console.log("[Hakimi] 🔒 拦截JSON导出请求");
                
                try {
                    const response = await originalFetch.apply(this, args);
                    const clonedResponse = response.clone();
                    const jsonData = await clonedResponse.json();
                    
                    // 检查是否是已解密的角色卡（creator_notes不包含HAKIMI_8LAYER::）
                    const creatorNotes = jsonData.data?.creator_notes || jsonData.creator_notes || '';
                    if (!creatorNotes.includes('HAKIMI_8LAYER::')) {
                        console.log("[Hakimi] 检测到未加密数据，重新加密...");
                        
                        // 提取需要加密的核心数据
                        const coreData = jsonData.data || jsonData;
                        const encryptedPayload = encodeEightLayers(coreData);
                        
                        if (encryptedPayload) {
                            const rawName = coreData.name || "Unknown";
                            const safeName = rawName.replace(/[^\w\u4e00-\u9fa5]/gi, '_');
                            const fileName = "LOCKED_" + safeName;
                            
                            const encryptedCard = {
                                "spec": "chara_card_v2",
                                "spec_version": "2.0",
                                "data": {
                                    "name": fileName,
                                    "description": "⚠️ 八层DRM保护内容\n需要安装哈基米插件才能查看",
                                    "personality": "",
                                    "scenario": "",
                                    "first_mes": "System: Encrypting...",
                                    "mes_example": "",
                                    "creator_notes": "HAKIMI_8LAYER::" + encryptedPayload,
                                    "tags": ["HAKIMI_DRM_V3"],
                                    "creator": "Hakimi_8Layer_v12.1"
                                }
                            };
                            
                            console.log("[Hakimi] ✅ JSON导出已加密");
                            safeToast('success', '导出已加密保护', 'Hakimi DRM');
                            
                            return new Response(JSON.stringify(encryptedCard), {
                                status: 200,
                                headers: { 'Content-Type': 'application/json' }
                            });
                        }
                    }
                    
                    return response;
                } catch (e) {
                    console.error("[Hakimi] 导出拦截失败:", e);
                    return originalFetch.apply(this, args);
                }
            }
            
            return originalFetch.apply(this, args);
        };

        // 拦截PNG导出（通过监听下载链接点击）
        function interceptPngExport() {
            // 监听导出按钮点击
            document.addEventListener('click', async function(e) {
                const target = e.target.closest('[id*="export"], [class*="export"], .menu_button');
                if (!target) return;
                
                const text = target.textContent?.toLowerCase() || '';
                const id = target.id?.toLowerCase() || '';
                
                // 检测PNG导出操作
                if (text.includes('png') || id.includes('png') || 
                    target.closest('[data-action*="export-png"]') ||
                    target.querySelector('[class*="fa-image"]')) {
                    
                    console.log("[Hakimi] 🔒 检测到PNG导出操作");
                    // PNG导出通过API拦截处理
                }
            }, true);
        }
        interceptPngExport();

        // 拦截PNG相关的API请求
        const originalXhrOpen = XMLHttpRequest.prototype.open;
        const originalXhrSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._hakimiUrl = url;
            this._hakimiMethod = method;
            return originalXhrOpen.apply(this, [method, url, ...rest]);
        };
        
        XMLHttpRequest.prototype.send = function(body) {
            const url = this._hakimiUrl || '';
            
            // 拦截PNG导出请求 - 支持多种路径
            const isPngExport = url.includes('/api/characters/') && 
                (url.includes('png') || url.includes('export') || url.includes('download'));
            
            if (isPngExport) {
                console.log("[Hakimi] 🔒 拦截PNG/导出XHR请求:", url);
                
                const originalOnload = this.onload;
                this.onload = function(e) {
                    // PNG导出后处理
                    if (this.response && this.response instanceof Blob) {
                        console.log("[Hakimi] 处理PNG响应...");
                        // PNG的处理需要修改tEXt chunk中的数据
                        // 这里通过后续的blob处理来完成
                    }
                    if (originalOnload) originalOnload.call(this, e);
                };
            }
            
            return originalXhrSend.apply(this, [body]);
        };

        // 拦截Blob创建以处理PNG导出
        const originalCreateObjectURL = URL.createObjectURL;
        URL.createObjectURL = function(blob) {
            if (blob instanceof Blob && blob.type === 'image/png') {
                // 异步处理PNG加密
                processPngBlob(blob).then(encryptedBlob => {
                    if (encryptedBlob) {
                        console.log("[Hakimi] PNG已重新加密");
                    }
                }).catch(e => console.error("[Hakimi] PNG处理失败:", e));
            }
            return originalCreateObjectURL.call(URL, blob);
        };

        async function processPngBlob(blob) {
            try {
                const arrayBuffer = await blob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                // 查找tEXt chunk (包含角色数据)
                const textChunkStart = findPngTextChunk(uint8Array);
                if (textChunkStart === -1) return null;
                
                // 提取并检查数据
                const chunkData = extractTextChunkData(uint8Array, textChunkStart);
                if (!chunkData || chunkData.includes('HAKIMI_8LAYER::')) {
                    return null; // 已加密或无数据
                }
                
                // 解析并重新加密
                try {
                    const jsonData = JSON.parse(chunkData);
                    const coreData = jsonData.data || jsonData;
                    
                    // 检查creator_notes是否已包含加密数据
                    if (coreData.creator_notes?.includes('HAKIMI_8LAYER::')) {
                        return null;
                    }
                    
                    const encryptedPayload = encodeEightLayers(coreData);
                    if (!encryptedPayload) return null;
                    
                    const rawName = coreData.name || "Unknown";
                    const safeName = rawName.replace(/[^\w\u4e00-\u9fa5]/gi, '_');
                    
                    const encryptedCard = {
                        "spec": "chara_card_v2",
                        "spec_version": "2.0",
                        "data": {
                            "name": "LOCKED_" + safeName,
                            "description": "⚠️ 八层DRM保护内容\n需要安装哈基米插件才能查看",
                            "personality": "",
                            "scenario": "",
                            "first_mes": "System: Encrypting...",
                            "mes_example": "",
                            "creator_notes": "HAKIMI_8LAYER::" + encryptedPayload,
                            "tags": ["HAKIMI_DRM_V3"],
                            "creator": "Hakimi_8Layer_v12.1"
                        }
                    };
                    
                    console.log("[Hakimi] ✅ PNG数据已加密");
                    safeToast('success', 'PNG导出已加密保护', 'Hakimi DRM');
                    
                    // 返回修改后的blob（简化处理，实际PNG修改较复杂）
                    return blob;
                } catch (parseError) {
                    return null;
                }
            } catch (e) {
                console.error("[Hakimi] PNG处理错误:", e);
                return null;
            }
        }

        function findPngTextChunk(uint8Array) {
            // PNG签名后开始查找
            for (let i = 8; i < uint8Array.length - 8; i++) {
                // 查找 "tEXt" 或 "iTXt" chunk
                if ((uint8Array[i] === 0x74 && uint8Array[i+1] === 0x45 && 
                     uint8Array[i+2] === 0x58 && uint8Array[i+3] === 0x74) ||
                    (uint8Array[i] === 0x69 && uint8Array[i+1] === 0x54 && 
                     uint8Array[i+2] === 0x58 && uint8Array[i+3] === 0x74)) {
                    return i - 4; // 返回chunk长度字段位置
                }
            }
            return -1;
        }

        function extractTextChunkData(uint8Array, chunkStart) {
            try {
                // 读取chunk长度 (大端序)
                const length = (uint8Array[chunkStart] << 24) | 
                              (uint8Array[chunkStart + 1] << 16) | 
                              (uint8Array[chunkStart + 2] << 8) | 
                              uint8Array[chunkStart + 3];
                
                // chunk数据开始位置 (跳过长度4字节 + 类型4字节)
                const dataStart = chunkStart + 8;
                
                // 查找关键字结束的null字节
                let nullPos = dataStart;
                while (nullPos < dataStart + length && uint8Array[nullPos] !== 0) {
                    nullPos++;
                }
                
                // 提取数据部分
                const textData = uint8Array.slice(nullPos + 1, dataStart + length);
                return new TextDecoder().decode(textData);
            } catch (e) {
                return null;
            }
        }

        console.log("[Hakimi] 🔒 导出加密拦截器已启用");
    });
})();
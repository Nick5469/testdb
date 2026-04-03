// src/services/dataService.js

// 数据加载服务
class DataService {
  constructor() {
    this.banksCache = new Map()
    this.chaptersCache = new Map()
    this.questionsCache = new Map()
    this.flatChaptersCache = new Map()
  }

  // 动态导入 JSON 文件 - 修正路径
  async importJson(path) {
    try {
      // 注意：路径需要相对于 src 目录
      // 例如: import(`../data/ncre3/chapters.json`)
      const module = await import(`../data/${path}`)
      return module.default
    } catch (error) {
      console.error(`导入失败: ../data/${path}`, error)
      return null
    }
  }

  // 加载题库列表
  async loadBanks() {
    if (this.banksCache.has('banks')) {
      return this.banksCache.get('banks')
    }

    try {
      const banksData = await this.importJson('Index.json')
      if (banksData && Array.isArray(banksData)) {
        this.banksCache.set('banks', banksData)
        return banksData
      }
      return []
    } catch (error) {
      console.error('加载题库列表失败:', error)
      return []
    }
  }

  // 加载指定题库的章节列表（树形结构）
  async loadChapters(bankId) {
    const cacheKey = `chapters_${bankId}`
    if (this.chaptersCache.has(cacheKey)) {
      return this.chaptersCache.get(cacheKey)
    }

    try {
      const chaptersData = await this.importJson(`${bankId}/chapters.json`)
      if (!chaptersData || !Array.isArray(chaptersData)) {
        console.warn(`章节数据为空或格式错误: ${bankId}`)
        return []
      }
      
      // 构建树形结构
      const treeData = this.buildTreeData(chaptersData)
      this.chaptersCache.set(cacheKey, treeData)
      return treeData
    } catch (error) {
      console.error(`加载章节列表失败 [${bankId}]:`, error)
      return []
    }
  }

  // 加载扁平化的章节数据（用于路径查找）
  async loadFlatChapters(bankId) {
    const cacheKey = `flat_${bankId}`
    if (this.flatChaptersCache.has(cacheKey)) {
      return this.flatChaptersCache.get(cacheKey)
    }

    try {
      const chaptersData = await this.importJson(`${bankId}/chapters.json`)
      if (!chaptersData || !Array.isArray(chaptersData)) {
        return []
      }
      
      this.flatChaptersCache.set(cacheKey, chaptersData)
      return chaptersData
    } catch (error) {
      console.error(`加载扁平化章节失败 [${bankId}]:`, error)
      return []
    }
  }

  // 加载指定章节的题目
  async loadQuestions(bankId, chapterId) {
    const cacheKey = `questions_${bankId}_${chapterId}`
    if (this.questionsCache.has(cacheKey)) {
      return this.questionsCache.get(cacheKey)
    }

    try {
      // 注意：题目文件直接放在题库目录下，文件名是章节ID
      const questionsData = await this.importJson(`${bankId}/${chapterId}.json`)
      if (!questionsData || !Array.isArray(questionsData)) {
        console.warn(`题目数据为空: ${bankId}/${chapterId}.json`)
        return []
      }
      
      // 转换题目格式为组件所需格式
      const formattedQuestions = this.formatQuestions(questionsData)
      this.questionsCache.set(cacheKey, formattedQuestions)
      return formattedQuestions
    } catch (error) {
      console.error(`加载题目失败 [${chapterId}]:`, error)
      return []
    }
  }

  // 构建树形数据结构
  buildTreeData(chapters) {
    const nodeMap = new Map()
    const roots = []

    // 创建节点映射
    chapters.forEach(item => {
      const node = {
        key: item.id,
        id: item.id,
        title: item.title,
        parentid: item.parentid,
        number: parseInt(item.number) || 0,
        weight: parseInt(item.weight) || 0,
        isLeaf: true,
        originalData: item
      }
      nodeMap.set(item.id, node)
    })

    // 构建树形结构
    chapters.forEach(item => {
      const node = nodeMap.get(item.id)
      if (!node) return
      
      // 判断是否为根节点
      if (item.parentid === "0" || item.parentid === 0 || !nodeMap.has(item.parentid)) {
        roots.push(node)
      } else {
        const parent = nodeMap.get(item.parentid)
        if (parent) {
          if (!parent.children) {
            parent.children = []
          }
          parent.children.push(node)
          parent.isLeaf = false
        } else {
          roots.push(node)
        }
      }
    })

    // 按权重排序
    const sortNodes = (nodes) => {
      if (!nodes) return
      nodes.sort((a, b) => (a.weight || 0) - (b.weight || 0))
      nodes.forEach(node => sortNodes(node.children))
    }
    sortNodes(roots)

    return roots
  }

  // 格式化题目数据
  formatQuestions(questions) {
    if (!Array.isArray(questions)) return []
    
    return questions.map(q => {
      // 解析选项
      let options = []
      try {
        if (q.options) {
          let parsedOptions = q.options
          if (typeof q.options === 'string') {
            parsedOptions = JSON.parse(q.options)
          }
          if (Array.isArray(parsedOptions)) {
            options = parsedOptions.map(opt => `${opt.Key}. ${opt.Value}`)
          }
        }
      } catch (e) {
        console.error('解析选项失败:', e)
        options = []
      }

      // 确定题型
      let questionType = 'single'
      if (q.ptype === '4') {
        questionType = 'multiple'
      } else if (q.qtype === '1') {
        questionType = 'single'
      } else if (q.qtype === '2') {
        questionType = 'judge'
      } else if (q.qtype === '3') {
        questionType = 'essay'
      }

      return {
        id: q.id,
        content: q.question,
        question_type: questionType,
        options: options,
        answer: q.answer,
        analysis: q.analysis || q.ai_analysis || '暂无解析',
        difficulty: parseInt(q.difficulty) || 2,
        score: 1,
        tags: q.chapters ? q.chapters.map(c => c.title) : [],
        knowledgePoints: q.chapters ? q.chapters.map(c => c.title) : [],
        statistics: {
          correctCount: parseInt(q.all_right) || 0,
          wrongCount: parseInt(q.all_wrong) || 0,
          accuracy: parseFloat(q.all_accuracy) || 0
        }
      }
    })
  }

  // 获取章节路径（用于面包屑）
  async getChapterPath(bankId, chapterId) {
    const flatChapters = await this.loadFlatChapters(bankId)
    const path = []
    
    // 递归查找父节点
    const findParent = (currentId, visited = new Set()) => {
      if (visited.has(currentId)) return null
      visited.add(currentId)
      
      const chapter = flatChapters.find(c => c.id === currentId)
      if (!chapter) return null
      
      path.unshift(chapter)
      
      if (chapter.parentid !== "0" && chapter.parentid !== 0) {
        return findParent(chapter.parentid, visited)
      }
      return chapter
    }
    
    findParent(chapterId)
    return path
  }

  // 获取章节的题目数量
  async getChapterQuestionCount(bankId, chapterId) {
    const questions = await this.loadQuestions(bankId, chapterId)
    return questions.length
  }

  // 清除缓存
  clearCache() {
    this.banksCache.clear()
    this.chaptersCache.clear()
    this.questionsCache.clear()
    this.flatChaptersCache.clear()
  }

  // 预加载题库数据
  async preloadBankData(bankId) {
    try {
      await this.loadChapters(bankId)
      await this.loadFlatChapters(bankId)
    } catch (error) {
      console.error(`预加载题库数据失败 [${bankId}]:`, error)
    }
  }
}

export default new DataService()
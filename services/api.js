import axios from 'axios'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

// 获取章节列表
export const getChapters = (bankId) => {
  return api.get('/chapters', { params: { bankId } })
}

// 获取指定章节的题目
export const getQuestionsByChapter = (chapterId, params) => {
  return api.get(`/chapters/${chapterId}/questions`, { params })
}

// 提交练习结果
export const submitPracticeResult = (data) => {
  return api.post('/practice/results', data)
}

export default api
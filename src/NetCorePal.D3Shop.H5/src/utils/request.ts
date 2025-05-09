// src/utils/request.ts
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { showToast } from 'vant'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'vue-router'


const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_NetCorePalD3Shop_WebApiUrl,
  timeout: import.meta.env.VITE_API_TIMEOUT
})

const authWhiteList = ['/api/ClientUserAccount/Login', '/api/ClientUserAccount/Register', '/api/ClientUserAccount/getRefreshToken'];
// 请求拦截器
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig<any>) => {
    // 在拦截器内部获取 store
    const authStore = useAuthStore()
    if (authWhiteList.includes(config.url!)) {
      return config;
    }
    if (authStore.token) {
      config.headers!['Authorization'] = 'Bearer ' + authStore.token
    }
    else {
      if (authStore.refreshToken) {
        authStore.tokenRefresh();
        config.headers!['Authorization'] = 'Bearer ' + authStore.token
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  (response: AxiosResponse<any>): any => {
    // 类型安全校验
    const isBaseResponse = (data: any): data is ResponseData => {
      return 'success' in data && 'code' in data && 'message' in data && 'errorData' in data
    }

    if (!isBaseResponse(response.data)) {
      console.error('非标准响应格式:', response.data)
      return response.data // 返回原始数据由业务层处理
    }

    const res = response.data
    // console.log(res,'接口响应')
    if (!res.success) {
      console.error(res, '标准错误')
      showToast(res.message)
      return Promise.reject(res.errorData)
    }
    // console.log(res.data,'标准成功')
    return res.data
  },
  async (error) => {
    // 在错误处理中获取 store 和 router
    const authStore = useAuthStore()
    const router = useRouter()
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // 防止无限循环

      try {
        await authStore.tokenRefresh();
        return service(originalRequest); // 重新执行原始请求
      } catch (refreshError) {
        authStore.logout()
        router.push('/login')
        return Promise.reject(refreshError)
      }
    }

    let message = ''
    const status = error.response?.status

    switch (status) {
      case 400:
        message = '请求错误'
        break
      case 403:
        message = '拒绝访问'
        break
      case 404:
        message = '请求地址不存在'
        break
      case 500:
        message = '服务器内部错误'
        break
      default:
        message = '网络连接故障'
    }

    showToast({
      message,
      position: 'top'
    })

    return Promise.reject(error)
  }
)

export default service
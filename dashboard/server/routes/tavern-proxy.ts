import { Router, Request, Response } from 'express'
import axios from 'axios'

const router = Router()
const TAVERN_API = 'http://tavern-server:3002/api/v1'

// Proxy all tavern API requests
router.get('/tavern/api/v1/*', async (req: Request, res: Response) => {
  try {
    const path = req.path.replace('/tavern/api/v1/', '')
    const response = await axios.get(`${TAVERN_API}/${path}`, {
      headers: { Authorization: req.headers.authorization ?? '' },
      params: req.query,
      timeout: 10000,
    })
    res.json(response.data)
  } catch (err: unknown) {
    const error = err as { response?: { status?: number; data?: unknown }; message?: string }
    res.status(error.response?.status ?? 500).json(error.response?.data ?? { message: 'proxy error' })
  }
})

router.post('/tavern/api/v1/*', async (req: Request, res: Response) => {
  try {
    const path = req.path.replace('/tavern/api/v1/', '')
    const response = await axios.post(`${TAVERN_API}/${path}`, req.body, {
      headers: { Authorization: req.headers.authorization ?? '', 'Content-Type': 'application/json' },
      timeout: 10000,
    })
    res.json(response.data)
  } catch (err: unknown) {
    const error = err as { response?: { status?: number; data?: unknown }; message?: string }
    res.status(error.response?.status ?? 500).json(error.response?.data ?? { message: 'proxy error' })
  }
})

export default router
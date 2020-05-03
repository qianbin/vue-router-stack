import _Vue from 'vue'
import Router, { Route } from 'vue-router'


function watchRouterReplace(router: Router) {
    const state = { replacing: true }
    const replaceFn = router.replace.bind(router)
    router.replace = <any>((loc: any, onComplete: any, onAbort: any) => {
        state.replacing = true
        if (onComplete || onAbort) {
            return replaceFn(loc, onComplete, (err) => {
                state.replacing = false
                onAbort && onAbort(err)
            })
        }
        return replaceFn(loc).catch(err => {
            state.replacing = false
            return Promise.reject(err)
        })
    })
    return state
}

const defaultSeqKey = 's~'
function makeSeq() {
    return Date.now().toString(16)
}

function decodeSeq(s: string) {
    try {
        return parseInt(s, 16)
    } catch{
        return 0
    }
}

export type Options = {
    router: Router
    seqKey?: string
}

export interface StackItem extends Route {
    seq: number
}

export default function install(Vue: typeof _Vue, options?: Options) {
    if (!options || !options.router) {
        throw new Error('invalid options')
    }

    const seqKey = options.seqKey || defaultSeqKey

    const router = options.router
    const state = watchRouterReplace(router)
    const stack = Vue.observable<{ items: StackItem[] }>({ items: [] })

    Object.defineProperty(Vue.prototype, '$routerStack', {
        get() { return stack }
    })

    router.beforeEach((to, from, next) => {
        if (to.query[seqKey]) {
            return next()
        }
        const query = { ...to.query }
        query[seqKey] = makeSeq()
        next({
            ...to,
            name: to.name || undefined,
            query,
            replace: state.replacing
        })
    })
    router.afterEach((to, from) => {
        const seq = decodeSeq(to.query[seqKey] as string)

        const i = stack.items.findIndex(r => r.seq >= seq)
        if (i >= 0) {
            stack.items.splice(i)
        } else if (state.replacing) {
            stack.items.pop()
        }
        stack.items.push({
            ...to,
            seq
        })

        // 
        state.replacing = false
    })
}

declare module 'vue/types/vue' {
    interface Vue {
        $routerStack: {
            items: StackItem[]
        }
    }
}

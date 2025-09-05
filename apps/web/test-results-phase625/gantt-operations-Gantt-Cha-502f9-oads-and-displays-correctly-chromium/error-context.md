# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e5]:
        - link "🎯 Gantt WebUI" [ref=e7] [cursor=pointer]:
          - /url: /
          - generic [ref=e8] [cursor=pointer]: 🎯
          - heading "Gantt WebUI" [level=1] [ref=e9] [cursor=pointer]
        - navigation [ref=e10]:
          - link "📝Issues" [ref=e11] [cursor=pointer]:
            - /url: /issues
            - generic [ref=e12] [cursor=pointer]: 📝
            - generic [ref=e13] [cursor=pointer]: Issues
          - link "📊WBS" [ref=e14] [cursor=pointer]:
            - /url: /wbs
            - generic [ref=e15] [cursor=pointer]: 📊
            - generic [ref=e16] [cursor=pointer]: WBS
          - link "📈Gantt" [ref=e17] [cursor=pointer]:
            - /url: /gantt
            - generic [ref=e18] [cursor=pointer]: 📈
            - generic [ref=e19] [cursor=pointer]: Gantt
        - button "プロジェクトを選択" [ref=e22]:
          - generic [ref=e23]: プロジェクトを選択
          - img [ref=e24]
        - generic [ref=e26]:
          - button [ref=e27]:
            - img
          - generic [ref=e31]: U
    - main [ref=e32]:
      - main [ref=e34]:
        - generic [ref=e37]:
          - img [ref=e39]
          - heading "No tasks to display" [level=3] [ref=e41]
          - paragraph [ref=e42]: This project doesn't have any tasks with dates.
  - alert [ref=e43]
```
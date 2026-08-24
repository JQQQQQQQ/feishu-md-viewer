# Complete Example: D365 Likes Aggregation

This example derives seven classes from the business content instead of assigning fixed colors to generic shape roles.

```mermaid
flowchart TD
    user(["用户发起点赞请求"])
    api("D365 Web API 接收请求")
    authenticated{"身份验证通过？"}
    authError(["返回身份验证错误"])
    alreadyLiked{"已存在点赞记录？"}
    createLike("创建点赞子记录")
    deleteLike("删除点赞子记录")
    plugin("触发汇总 Plug-in")
    countLikes("重新统计有效点赞")
    updateMaster("更新主记录点赞总数")
    success(["返回操作成功"])

    user --> api --> authenticated
    authenticated -- "否" --> authError
    authenticated -- "是" --> alreadyLiked
    alreadyLiked -- "否" --> createLike
    alreadyLiked -- "是" --> deleteLike
    createLike --> plugin
    deleteLike --> plugin
    plugin --> countLikes --> updateMaster --> success

    classDef entry fill:#F2F3F5,stroke:#8F959E,stroke-width:2px,color:#373C43
    classDef auth fill:#FFECEC,stroke:#F54A45,stroke-width:2px,color:#A61D24
    classDef likestate fill:#F3E8FF,stroke:#8B5CF6,stroke-width:2px,color:#5B21B6
    classDef childrecord fill:#FFF3E0,stroke:#F59E0B,stroke-width:2px,color:#92400E
    classDef aggregation fill:#E6FFFB,stroke:#13C2C2,stroke-width:2px,color:#006D75
    classDef masterupdate fill:#E8F3FF,stroke:#3370FF,stroke-width:2px,color:#1D39C4
    classDef success fill:#E8FFEA,stroke:#34A853,stroke-width:2px,color:#176B2C

    class user,api entry
    class authenticated,authError auth
    class alreadyLiked likestate
    class createLike,deleteLike childrecord
    class plugin,countLikes aggregation
    class updateMaster masterupdate
    class success success
```

Legend: Gray = request entry; red = authentication and authentication error; purple = current like state; orange = child-record changes; cyan = plug-in aggregation; blue = master-record update; green = successful outcome.

package dev.tafe.HelloWorld;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloWorldOutput {
    @GetMapping("/getinput")
    public int getInput(){
        return 10 ;
    }
}

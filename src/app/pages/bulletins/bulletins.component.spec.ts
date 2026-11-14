import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { BulletinsComponent } from './bulletins.component';

describe('BulletinsComponent', () => {
  let component: BulletinsComponent;
  let fixture: ComponentFixture<BulletinsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulletinsComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(BulletinsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
